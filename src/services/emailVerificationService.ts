import dns from 'dns';
import {promisify} from 'util';
import validator from 'validator';
import logger from '../utils/logger';
import axios from 'axios';
import prisma from '../config/prismaClient';

interface VerificationResult {
    is_disposable: boolean;
    has_mx_records: boolean;
    can_receive_email: boolean;
    errors: {
        syntax: string | null;
        disposable_email: string | null;
        mx_records: string | null;
        receive_email: string | null;
    };
    ip_address: string | null;
}

const resolveMx = promisify(dns.resolveMx);
const resolve4 = promisify(dns.resolve4);

const disposableDomainCache = new Set<string>();
const disposableIpCache = new Set<string>();

// Add known disposable IPs to the cache
disposableIpCache.add('167.172.13.163');

async function checkMxRecords(domain: string): Promise<boolean> {
    try {
        const records = await resolveMx(domain);
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
        const addresses = await resolve4(domain);
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

// A mock function to demonstrate checking if an email can receive emails.
// This function simulates the behavior of an SMTP server check, but it should be replaced
// with an actual SMTP verification implementation if needed.
async function canReceiveEmail(domain: string): Promise<boolean> {
    // Implement SMTP handshake here if needed
    // For now, we assume that if MX records exist, the email can receive emails
    return checkMxRecords(domain);
}

async function verifyEmail(email: string): Promise<VerificationResult> {
    if (!validator.isEmail(email)) {
        return {
            is_disposable: false,
            has_mx_records: false,
            can_receive_email: false,
            errors: {
                syntax: 'Invalid email syntax',
                disposable_email: null,
                mx_records: null,
                receive_email: null,
            },
            ip_address: null,
        };
    }

    const domain = email.split('@')[1];
    const subdomain = `mail.${domain}`;
    const ipAddress = await getDomainIp(subdomain) || await getDomainIp(domain);

    const [isDisposableEmail, hasMxRecords, canReceiveEmailResult] = await Promise.all([
        isDisposable(email, ipAddress),
        checkMxRecords(domain),
        canReceiveEmail(domain),
    ]);

    const result: VerificationResult = {
        is_disposable: isDisposableEmail,
        has_mx_records: hasMxRecords,
        can_receive_email: canReceiveEmailResult,
        errors: {
            syntax: null,
            disposable_email: isDisposableEmail ? 'Email is from a disposable email provider' : null,
            mx_records: hasMxRecords ? null : 'Domain does not have valid MX records',
            receive_email: canReceiveEmailResult ? null : 'Email cannot receive emails',
        },
        ip_address: ipAddress,
    };

    logger.info(`Email verification result for ${email}: ${JSON.stringify(result)}`);

    return result;
}

export default {
    verifyEmail,
};
