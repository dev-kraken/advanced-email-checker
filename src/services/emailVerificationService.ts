import dns from 'dns';
import {promisify} from 'util';
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
}

const resolveMx = promisify(dns.resolveMx);

const disposableDomainCache = new Set<string>();

async function checkMxRecords(domain: string): Promise<boolean> {
    try {
        const records = await resolveMx(domain);
        return records.length > 0;
    } catch (err) {
        logger.error(`MX record check failed for domain ${domain}: ${(err as Error).message}`);
        return false;
    }
}

async function isDisposable(email: string): Promise<boolean> {
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

        return isDisposable;
    } catch (error) {
        logger.error('Failed to validate email:', error);
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
        };
    }

    const [isDisposableEmail, hasMxRecords] = await Promise.all([
        isDisposable(email),
        checkMxRecords(email.split('@')[1]),
    ]);

    const result: VerificationResult = {
        is_disposable: isDisposableEmail,
        has_mx_records: hasMxRecords,
        errors: {
            syntax: null,
            disposable_email: isDisposableEmail ? 'Email is from a disposable email provider' : null,
            mx_records: hasMxRecords ? null : 'Domain does not have valid MX records',
        },
    };

    logger.info(`Email verification result for ${email}: ${JSON.stringify(result)}`);

    return result;
}

export default {
    verifyEmail,
};
