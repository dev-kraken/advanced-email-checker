import dns from 'dns';
import {promisify} from 'util';
import validator from 'validator';
import logger from '../utils/logger';
import axios from 'axios';
import prisma from '../config/prismaClient';

interface VerificationResult {
    is_disposable: boolean;
    has_mx_records: boolean;
    smtp_valid: boolean;
    errors: {
        syntax: string | null;
        disposable_email: string | null;
        mx_records: string | null;
        smtp: string | null;
    };
}

const resolveMx = promisify(dns.resolveMx);

async function checkMxRecords(domain: string): Promise<boolean> {
    try {
        const records = await resolveMx(domain);
        return records.length > 0;
    } catch (err) {
        logger.error(`MX record check failed for domain ${domain}: ${(err as Error).message}`);
        return false;
    }
}

// async function checkSmtp(email: string): Promise<boolean> {
//     // const [user, domain] = email.split('@');
//     // try {
//     //     const records = await resolveMx(domain);
//     //     if (records.length === 0) return false;
//     //
//     //     const mxHost = records[0].exchange;
//     //
//     //     const transporter = nodemailer.createTransport({
//     //         host: mxHost,
//     //         port: 25,
//     //         secure: false, // use TLS
//     //         tls: {
//     //             rejectUnauthorized: false
//     //         },
//     //         connectionTimeout: 5000 // 5 seconds
//     //     });
//     //
//     //     return new Promise((resolve) => {
//     //         transporter.verify((error) => {
//     //             if (error) {
//     //                 logger.error(`SMTP validation failed for email ${email}: ${error.message}`);
//     //                 resolve(false);
//     //             } else {
//     //                 resolve(true);
//     //             }
//     //         });
//     //     });
//     // } catch (err) {
//     //     logger.error(`SMTP validation failed for email ${email}: ${(err as Error).message}`);
//     //     return false;
//     // }
//     return false;
// }

async function isDisposable(email: string): Promise<boolean> {
    const domain = email.split('@')[1];


    const disposableDomain = await prisma.tempEmailDomains.findFirst({
        where: {emailDomain: domain}
    });

    if (!disposableDomain) {

        try {
            const response = await axios.get(`https://disposable.debounce.io/?email=${email}`);
            const isDisposable = response.data.disposable === 'true';

            if (isDisposable) {
                await prisma.tempEmailDomains.create({data: {emailDomain: domain}});
            }

            return isDisposable;
        } catch (error) {
            logger.error('Failed to validate email:', error);
            return false;
        }
    }
    return true
}

async function verifyEmail(email: string): Promise<VerificationResult> {
    if (!validator.isEmail(email)) {
        return {
            is_disposable: false,
            has_mx_records: false,
            smtp_valid: false,
            errors: {
                syntax: 'Invalid email syntax',
                disposable_email: null,
                mx_records: null,
                smtp: null,
            },
        };
    }

    const [isDisposableEmail, hasMxRecords] = await Promise.all([
        isDisposable(email),
        checkMxRecords(email.split('@')[1]),
        // checkSmtp(email)
    ]);

    const result: VerificationResult = {
        is_disposable: isDisposableEmail,
        has_mx_records: hasMxRecords,
        smtp_valid: false,
        errors: {
            syntax: null,
            disposable_email: isDisposableEmail ? 'Email is from a disposable email provider' : null,
            mx_records: hasMxRecords ? null : 'Domain does not have valid MX records',
            smtp: 'SMTP validation failed',
        },
    };

    logger.info(`Email verification result for ${email}: ${JSON.stringify(result)}`);

    return result;
}

export default {
    verifyEmail,
};
