import dns from 'dns';
import {promisify} from 'util';
import validator from 'validator';
import nodemailer from 'nodemailer';
import logger from '../utils/logger';
import * as fs from "node:fs";
import path from "node:path";

const resolveMx = promisify(dns.resolveMx);

// Load the domain list from the JSON file
const domainFilePath = path.join(__dirname, '../../domains.json');
const disposableDomains: Set<string> = new Set(JSON.parse(fs.readFileSync(domainFilePath, 'utf8')));

async function checkMxRecords(domain: string): Promise<boolean> {
    try {
        const records = await resolveMx(domain);
        return records.length > 0;
    } catch (err) {
        logger.error(`MX record check failed for domain ${domain}: ${(err as Error).message}`);
        return false;
    }
}

async function checkSmtp(email: string): Promise<boolean> {
    const [user, domain] = email.split('@');
    try {
        const records = await resolveMx(domain);
        if (records.length === 0) return false;

        const mxHost = records[0].exchange;

        const transporter = nodemailer.createTransport({
            host: mxHost,
            port: 25,
            secure: false, // use TLS
            tls: {
                rejectUnauthorized: false
            },
            connectionTimeout: 5000 // 5 seconds
        });

        return new Promise((resolve) => {
            transporter.verify((error, success) => {
                if (error) {
                    logger.error(`SMTP validation failed for email ${email}: ${error.message}`);
                    resolve(false);
                } else {
                    resolve(true);
                }
            });
        });
    } catch (err) {
        logger.error(`SMTP validation failed for email ${email}: ${(err as Error).message}`);
        return false;
    }
}

function isDisposable(email: string): boolean {
    const domain = email.split('@')[1];
    return disposableDomains.has(domain);
}

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

    const isDisposableEmail = isDisposable(email);
    const [hasMxRecords, smtpValid] = await Promise.all([
        checkMxRecords(email.split('@')[1]),
        checkSmtp(email)
    ]);

    const result: VerificationResult = {
        is_disposable: isDisposableEmail,
        has_mx_records: hasMxRecords,
        smtp_valid: smtpValid,
        errors: {
            syntax: null,
            disposable_email: isDisposableEmail ? 'Email is from a disposable email provider' : null,
            mx_records: hasMxRecords ? null : 'Domain does not have valid MX records',
            smtp: smtpValid ? null : 'SMTP validation failed',
        },
    };

    logger.info(`Email verification result for ${email}: ${JSON.stringify(result)}`);

    return result;
}

export default {
    verifyEmail,
};