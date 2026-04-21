# TRtripsathi Backend

NestJS 11 backend for TRtripsathi. The repository now has MongoDB, Cloudinary, and a complete phone-based authentication flow with JWT, RBAC, rate limiting, and account lockout.

## What Is Implemented

- Database connection and startup validation through `@nestjs/config` and Mongoose
- Cloudinary signature generation for frontend direct uploads
- Phone-number signup and signin
- JWT access and refresh token flow with httpOnly cookies
- Protected profile completion after signin
- Role-based authorization for `admin` and `user`
- Login throttling and account lockout after repeated failures
- Swagger documentation for all public endpoints

## Technology Stack

- NestJS 11.0.1
- TypeScript
- MongoDB with Mongoose ODM
- JWT via `@nestjs/jwt` and `passport-jwt`
- bcrypt for password hashing
- class-validator and global ValidationPipe
- Swagger/OpenAPI via `@nestjs/swagger`
- Helmet and cookie-parser for security and cookie support

## Environment Variables

Create `backend/.env` with these values:

```env
PORT=5000

MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/?appName=<app>

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

JWT_ACCESS_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

FRONTEND_URL=http://localhost:3000
```

Notes:
- `FRONTEND_URL` is required for CORS and cookie-based auth.
- Cookie security is environment-aware and uses secure cookies in production.

## Install

```bash
npm install
```

## Run

```bash
npm run start:dev
```

Other scripts:

```bash
npm run build
npm run start:prod
npm run test
npm run test:e2e
```

## Authentication Design

Authentication credentials are stored in the auth schema, while profile fields are stored in a separate user schema linked by `authId`.

### Signup Flow

`POST /auth/signup`

Request body:

```json
{
  "phoneNumber": "9876543210",
  "password": "Password@123"
}
```

Behavior:
- Creates the account with hashed password
- Defaults the role to `user`
- Issues access and refresh tokens
- Stores refresh token only as a bcrypt hash
- Sets `access_token` and `refresh_token` cookies

### Signin Flow

`POST /auth/login`

Request body:

```json
{
  "phoneNumber": "9876543210",
  "password": "Password@123"
}
```

Behavior:
- Validates password against bcrypt hash
- Returns generic invalid-credentials errors
- Locks the account for 15 minutes after 5 failed attempts
- Resets failed attempt counters on success
- Issues and stores fresh JWT cookies

### Profile Completion

`PATCH /auth/profile`

Required fields:
- `firstName`
- `lastName`
- `age` greater than 8
- `profilePhoto`
- `bio`
- `location`
- `province`
- `district`
- `landmark`
- `experienceLevel`

Optional field:
- `middleName`

This endpoint updates the user profile document and marks the profile as complete.

### Token Flow

- Access token expires in 15 minutes by default
- Refresh token expires in 7 days by default
- Access token can be read from the Bearer header or `access_token` cookie
- Refresh token is read from the `refresh_token` cookie
- Logout clears cookies and revokes the stored refresh token hash

## Security Controls

- Helmet enabled in `main.ts`
- CORS restricted to `FRONTEND_URL`
- Login and signup are throttled to 5 requests per minute per IP
- Refresh token is stored as a hash only
- Account lockout prevents brute-force login attempts
- Admin-only endpoints use role guards

## API Endpoints

### Authentication

- `POST /auth/signup` - Create account
- `POST /auth/login` - Sign in
- `PATCH /auth/profile` - Complete profile after signin
- `POST /auth/refresh` - Refresh tokens using cookie
- `POST /auth/logout` - Logout and revoke refresh token
- `GET /auth/me` - Get current authenticated user
- `GET /auth/admin-only` - Admin-only sample protected route

### Cloudinary

- `POST /cloudinary/signature` - Generate upload signature

## Project Structure

```text
backend/src/
├── main.ts
├── app.module.ts
├── auth/
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.module.ts
│   ├── AUTH_README.md
│   ├── constants/
│   ├── decorators/
│   ├── dto/
│   ├── guards/
│   ├── schemas/
│   └── strategies/
├── user/
│   ├── user.module.ts
│   ├── user.service.ts
│   └── schemas/
│       └── user.schema.ts
├── config/
│   ├── database/
│   ├── cloudinary/
```

## Data Model

Auth collection stores:

```typescript
{
  phoneNumber: string,
  password: string,
  role: 'user' | 'admin',
  refreshTokenHash: string | null,
  failedLoginAttempts: number,
  lockUntil: Date | null,
  createdAt: Date,
  updatedAt: Date
}
```

User collection stores:

```typescript
{
  authId: ObjectId,
  profileCompleted: boolean,
  firstName: string | null,
  middleName: string | null,
  lastName: string | null,
  age: number | null,
  profilePhoto: string | null,
  bio: string | null,
  location: string | null,
  province: string | null,
  district: string | null,
  landmark: string | null,
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert' | null,
  createdAt: Date,
  updatedAt: Date
}
```

## Swagger

Swagger is available at:

```text
http://localhost:5000/api/docs
```

It includes request/response examples for auth and Cloudinary endpoints.

## Build Verification

The backend currently builds successfully with:

```bash
npm run build
```

## Notes

- The auth module has a dedicated [AUTH_README.md](src/auth/AUTH_README.md) for endpoint-level details.
- Profile data is now separated into the user module to keep auth focused on credentials and token flows.
