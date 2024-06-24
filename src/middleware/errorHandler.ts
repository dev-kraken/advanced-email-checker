import {Request, Response, NextFunction} from 'express';

const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
    console.error(err);

    if (res.headersSent) {
        return next(err);
    }

    res.status(err.statusCode || 500).json({
        message: err.message || 'An unexpected error occurred',
        // You might include more details depending on the environment (e.g., stack trace in development)
    });
}

export default errorHandler;
