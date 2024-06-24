# Advanced Email Checker API

## Description

The Advanced Email Checker API is a Node.js service that verifies email addresses by checking MX records and SMTP validity. This service is built with TypeScript and includes features such as rate limiting and disposable email domain checking.

## Features

- **Email Verification**: Check if an email address has valid MX records and can accept emails via SMTP.
- **Disposable Email Detection**: Identify disposable email addresses using a predefined list of domains.
- **Rate Limiting**: Limit requests to the email verification endpoint to prevent abuse.
- **Welcome Message**: A simple welcome message for the home route.

## Requirements

- Node.js (version 12 or higher)
- npm (version 6 or higher)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/devkraken/advanced-email-checker.git
   cd advanced-email-checker
    ```
2. Install the dependencies:

    ```bash
    npm install
    ```
3. Create a .env file in the root directory and set the following environment variable:

    ```dotenv
    PORT=3000
    ```
4. Add your list of disposable domains in a file named domains.json in the root directory:

    ```json
    [
    "mailinator.com",
    "guerrillamail.com",
    "10minutemail.com",
     //Add more domains as needed
    ]
    ```
   
## Usage

### Development

To run the server in development mode with hot-reloading:

```bash
npm run dev
```

### Production

1. Compile the TypeScript code:
    ```bash
    npm run build
    ```

2. Start the server:
    ```bash
    npm start
    ```
   
## API Endpoints

### Home Route

* URL: `/`

* Method: `GET`

* Response:

```json
{
  "message": "Welcome to the Advanced Email Checker API"
}
```

### Verify Email

* URL: `/verify-email`

* Method: `POST`

* Request Body:

```json
{
  "email": "example@example.com"
}
```
* Response:

```json
{
  "is_disposable": false,
  "has_mx_records": true,
  "smtp_valid": true,
  "errors": {
    "syntax": null,
    "disposable_email": null,
    "mx_records": null,
    "smtp": null
  }
}
```

* Rate Limiting: Maximum of 10 requests per minute per IP address. Exceeding this limit will result in a 429 response with the following message:

```json
{
  "error": "Too many requests from this IP, please try again after a minute"
}
```

## Logging
Logs are generated using Winston and stored in error.log for errors and combined.log for all logs.

## Author

Dev Kraken - [soman@devkraken.com](mailto:soman@devkraken.com) - https://devkraken.com

