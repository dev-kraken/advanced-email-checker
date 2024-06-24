import {Request, Response} from 'express';
import emailVerificationService from '../services/emailVerificationService';

async function verifyEmail(req: Request, res: Response): Promise<void> {
    const {email} = req.body;
    if (!email || !email.includes('@')) {
        res.status(400).json({error: 'Invalid email'});
        return;
    }

    try {
        const result = await emailVerificationService.verifyEmail(email);
        res.status(200).json(result);
    } catch (err) {
        const errorMessage = (err instanceof Error) ? err.message : 'Internal Server Error';
        res.status(500).json({error: errorMessage});
    }
}

export default {
    verifyEmail,
};
