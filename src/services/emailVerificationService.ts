import dns from 'dns';
import validator from 'validator';
import logger from '../utils/logger';
import axios from 'axios';
import prisma from '../config/prismaClient';

interface VerificationResult {
    is_disposable: boolean;
    has_mx_records: boolean;
    errors: {
        syntax: string | null;
        disposable_email: string | null;
        mx_records: string | null;
    };
    ip_address: string | null;
}

const disposableDomainCache = new Set<string>();
const disposableIpCache = new Set<string>();

// Add known disposable IPs to the cache
disposableIpCache.add('167.172.13.163');

async function checkMxRecords(domain: string): Promise<boolean> {
    try {
        const records = await dns.promises.resolveMx(domain);
        return records.length > 0;
    } catch (err: unknown) {
        if (err instanceof Error) {
            logger.error(`MX record check failed for domain ${domain}: ${err.message}`);
        } else {
            logger.error(`MX record check failed for domain ${domain}: unknown error`);
        }
        return false;
    }
}

async function getDomainIp(domain: string): Promise<string | null> {
    try {
        const addresses = await dns.promises.resolve4(domain);
        return addresses.length > 0 ? addresses[0] : null;
    } catch (err: unknown) {
        if (err instanceof Error) {
            if ((err as NodeJS.ErrnoException).code === 'ENODATA') {
                logger.warn(`No A records found for domain ${domain}`);
            } else {
                logger.error(`IP address check failed for domain ${domain}: ${err.message}`);
            }
        } else {
            logger.error(`IP address check failed for domain ${domain}: unknown error`);
        }
        return null;
    }
}

async function isDisposable(email: string, ipAddress: string | null): Promise<boolean> {
    const domain = email.split('@')[1];

    if (disposableDomainCache.has(domain)) {
        return true;
    }

    const disposableDomain = await prisma.tempEmailDomains.findFirst({
        where: {emailDomain: domain}
    });

    if (disposableDomain) {
        disposableDomainCache.add(domain);
        return true;
    }

    try {
        const response = await axios.get(`https://disposable.debounce.io/?email=${email}`);
        const isDisposable = response.data.disposable === 'true';

        if (isDisposable) {
            await prisma.tempEmailDomains.create({data: {emailDomain: domain}});
            disposableDomainCache.add(domain);
        }

        if (isDisposable || (ipAddress && disposableIpCache.has(ipAddress))) {
            return true;
        }

        return isDisposable;
    } catch (error: unknown) {
        if (error instanceof Error) {
            logger.error('Failed to validate email:', error.message);
        } else {
            logger.error('Failed to validate email: unknown error');
        }
        return false;
    }
}

async function verifyEmail(email: string): Promise<VerificationResult> {
    if (!validator.isEmail(email)) {
        return {
            is_disposable: false,
            has_mx_records: false,
            errors: {
                syntax: 'Invalid email syntax',
                disposable_email: null,
                mx_records: null,
            },
            ip_address: null,
        };
    }

    const domain = email.split('@')[1];
    const subdomain = `mail.${domain}`;
    const ipAddress = await getDomainIp(subdomain) || await getDomainIp(domain);

    const [isDisposableEmail, hasMxRecords] = await Promise.all([
        isDisposable(email, ipAddress),
        checkMxRecords(domain),
    ]);

    const result: VerificationResult = {
        is_disposable: isDisposableEmail,
        has_mx_records: hasMxRecords,
        errors: {
            syntax: null,
            disposable_email: isDisposableEmail ? 'Email is from a disposable email provider' : null,
            mx_records: hasMxRecords ? null : 'Domain does not have valid MX records',
        },
        ip_address: ipAddress,
    };

    logger.info(`Email verification result for ${email}: ${JSON.stringify(result)}`);

    return result;
}

export default {
    verifyEmail,
};
