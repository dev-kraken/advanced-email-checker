import dotenv from 'dotenv';

dotenv.config();

const config = {
    port: process.env.PORT || 3000,
};

export default config;
