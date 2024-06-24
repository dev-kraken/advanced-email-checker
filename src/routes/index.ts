import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import emailVerificationController from '../controllers/emailVerificationController';

const router = Router();

// Rate limiting middleware with custom handler for the /verify-email route
const verifyEmailLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 requests per windowMs
    handler: (req, res) => {
        res.status(429).json({
            error: 'Too many requests from this IP, please try again after a minute'
        });
    }
});

// Home route with a welcome message
router.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Dev Kraken'
    });
});

// Apply the rate limiting middleware to the /verify-email route
router.post('/verify-email', verifyEmailLimiter, emailVerificationController.verifyEmail);

export default router;