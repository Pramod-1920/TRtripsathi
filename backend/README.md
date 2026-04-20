# TRtripsathi Backend

A robust NestJS backend application for the TRtripsathi travel platform with integrated MongoDB database, Cloudinary media management, and comprehensive API documentation.

## Overview

This is a production-ready NestJS backend featuring:
- Strict environment-based configuration
- MongoDB integration for data persistence
- Cloudinary integration for media uploads
- User authentication with signup
- Comprehensive Swagger/OpenAPI documentation
- Clean architecture with dedicated config modules

## Technology Stack

- **Framework**: NestJS 11.0.1
- **Database**: MongoDB 9.4.1 (Mongoose ODM)
- **Media Storage**: Cloudinary v2 SDK
- **Authentication**: bcrypt 6.0.0 for password hashing
- **Validation**: class-validator 0.15.1 with global ValidationPipe
- **API Documentation**: @nestjs/swagger for OpenAPI/Swagger support
- **Language**: TypeScript

## Environment Setup

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Server
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=<app>

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# JWT (for future implementation)
JWT_SECRET=your_jwt_secret_key
```

### Configuration Notes:
- `PORT`: Must be a valid numeric port (no fallback to random ports on conflict)
- `MONGODB_URI`: Full connection string to MongoDB Atlas cluster
- Cloudinary credentials: Obtain from your Cloudinary dashboard

## Installation

```bash
$ npm install
```

## Running the Application

### Development
```bash
$ npm run start:dev
```
Starts the application in watch mode. NestJS will recompile on file changes.

### Production
```bash
$ npm run start:prod
```
Builds and runs the optimized production version.

### Standard Start
```bash
$ npm run start
```

## API Documentation

Once the server is running, access the interactive Swagger/OpenAPI documentation at:

```
http://localhost:5000/api/docs
```

The API documentation includes:
- All available endpoints (GET, POST, etc.)
- Request parameters and body schemas
- Response schemas with examples
- Field validation rules and examples

### Available Endpoints

#### Health Check
- **GET** `/` - Returns a greeting message

#### Authentication
- **POST** `/auth/signup` - Register a new user
  - Request body: `SignupDto` (name, email, phoneNumber, password)
  - Validation: Email must be unique, phone number (10 digits), password must contain uppercase, lowercase, number, special character

#### Cloudinary
- **POST** `/cloudinary/signature` - Get upload signature for direct Cloudinary uploads
  - Request body: `CloudinarySignatureDto` (optional folder)
  - Response: Signature data for frontend direct upload implementation

## Project Structure

```
backend/src/
├── main.ts                           # Application entry point with MongoDB connection logging
├── app.module.ts                     # Root module with all service imports
├── app.controller.ts                 # Health check endpoint
├── app.service.ts                    # Health check service
│
├── auth/                             # Authentication module
│   ├── auth.controller.ts            # Signup endpoint
│   ├── auth.service.ts               # Auth business logic
│   ├── auth.module.ts                # Auth module configuration
│   └── dto/
│       └── signup.dto.ts             # Signup validation schema
│
└── config/                           # External service configuration
    ├── database/
    │   ├── database.config.ts        # MongoDB connection factory
    │   └── database.module.ts        # Mongoose module setup
    │
    └── cloudinary/
        ├── cloudinary.config.ts      # Cloudinary SDK initialization
        ├── cloudinary.module.ts      # Cloudinary module with service/controller
        ├── cloudinary.service.ts     # Upload signature generation
        ├── cloudinary.controller.ts  # Cloudinary API endpoints
        └── dto/
            └── cloudinary-signature.dto.ts  # Signature request schema
```

## Key Features Implemented

### 1. Strict Configuration Management
- Environment variables validated at startup
- Errors thrown immediately if required config is missing
- No fallback behavior to prevent hidden issues

### 2. Database Integration
- MongoDB connection via Mongoose ODM
- Clean config factory pattern in dedicated module
- Connection event logging: "Connected to database: test"
- Startup verification: "=== MONGODB CONNECTED SUCCESSFULLY: test ===" banner

### 3. Media Management
- Cloudinary integration for scalable image storage
- Signature endpoint for secure frontend direct uploads
- Optional folder parameter for organizing uploads
- Credentials validated at module initialization

### 4. Authentication (Partial)
- Signup endpoint with email/phone uniqueness validation
- Password hashing with bcrypt (10 rounds)
- SignupDto with comprehensive field validation
- TODO: Login endpoint, refresh token, JWT implementation

### 5. Input Validation
- Global ValidationPipe with strict whitelist mode
- Prevents accidental field injection
- Class-validator decorators on all DTOs
- Detailed error messages for validation failures

### 6. API Documentation
- Swagger/OpenAPI integration with @nestjs/swagger
- All controllers tagged with `@ApiTags()`
- All endpoints documented with `@ApiOperation()` and responses
- All DTO fields documented with `@ApiProperty()` including examples

## Database Schema

### Auth Collection
```typescript
{
  name: string,           // User full name
  email: string,          // Unique email address
  phoneNumber: string,    // 10-digit phone number
  password: string,       // Hashed with bcrypt
  createdAt: Date,        // Auto-generated
  updatedAt: Date         // Auto-generated
}
```

## Testing

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Cloudinary Direct Upload Flow

The backend implements **Option 2** - Frontend direct uploads with backend signature endpoint:

1. **Frontend**: Requests upload signature from `POST /cloudinary/signature`
2. **Backend**: Validates request, generates signed signature using Cloudinary API
3. **Frontend**: Uses signature to upload directly to Cloudinary
4. **Cloudinary**: Delivers media and notifies backend via webhook (if configured)

Benefits:
- Reduced server load (no file upload processing)
- Faster uploads (direct to CDN)
- Scalability (handles unlimited concurrent uploads)
- Security (signed requests prevent unauthorized uploads)

## Deployment

When deploying to production:

1. Ensure all `.env` variables are properly set in production environment
2. Build with: `npm run build`
3. Start with: `npm run start:prod`
4. Verify startup logs show MongoDB connection and Swagger endpoint active
5. Test API endpoints via Swagger UI at `/api/docs`

## Troubleshooting

### MongoDB Connection Failed
- Check `MONGODB_URI` in `.env`
- Ensure IP address is whitelisted in MongoDB Atlas
- Verify network connectivity to the cluster

### Cloudinary Upload Issues
- Verify `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are correct
- Check Cloudinary dashboard for API key status
- Ensure folder name (if specified) is valid

### Port Already in Use
- Change `PORT` in `.env` to an available port
- Or kill existing process on the port

### Validation Errors
- Check request body matches DTO requirements
- Refer to Swagger documentation for field specifications
- Verify email format and phone number is exactly 10 digits
