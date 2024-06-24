import express from 'express';
import bodyParser from 'body-parser';
import rateLimit from 'express-rate-limit';
import config from './config';
import emailVerificationController from './controllers/emailVerificationController';

// Create Express app
const app = express();

// Trust the reverse proxy
app.set('trust proxy', 1);  // 1 mean trusting the first proxy

// Middleware to parse JSON bodies
app.use(bodyParser.json());

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
app.get('/', (req, res) => {
    res.json({
        message: 'Welcome to Dev Kraken'
    });
});

// Apply the rate limiting middleware to the /verify-email route
app.post('/verify-email', verifyEmailLimiter, emailVerificationController.verifyEmail);

// Start the server
app.listen(config.port, () => {
    console.log(`Server is running on http://localhost:${config.port}`);
});
