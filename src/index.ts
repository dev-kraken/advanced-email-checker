import express from 'express';
import bodyParser from 'body-parser';
import config from './config';
import router from "./routes";
import errorHandler from "./middleware/errorHandler";

// Create Express app
const app = express();

// Trust the reverse proxy
app.set('trust proxy', 1);  // 1 mean trusting the first proxy

// Middleware to parse JSON bodies
app.use(bodyParser.json());

app.use(router)

app.use(errorHandler);

// Start the server
app.listen(config.port, () => {
    console.log(`App listening on port ${config.port}`);
});
