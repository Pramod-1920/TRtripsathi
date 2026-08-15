# Auth Module README

This module implements JWT-based authentication with refresh tokens and role-based access control for two roles:

- admin
- user

Credentials are stored in the auth schema, while profile fields are stored in a separate user schema linked through `authId`.

## Features

- Signup with phone number + password hashing (bcrypt)
- Sign up and sign in with phone number + password
- Profile completion after signin
- Access token + refresh token flow
- Refresh token validation from `refresh_token` httpOnly cookie
- Logout that revokes stored refresh token
- Access token guard for protected routes
- Roles guard for admin/user authorization
- Account lockout after repeated failed login attempts
- Rate limiting on signup/login endpoints
- Email/SMS one-time-code verification for new accounts
- Enumeration-resistant forgot-password and one-time-code reset
- One-time challenges stored as HMAC digests with expiry, cooldown, attempt limits, and TTL cleanup

## Required Environment Variables

Add these to `backend/.env`:

```env
JWT_ACCESS_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000
AUTH_OTP_SECRET=replace_with_at_least_32_random_characters
email=your-gmail-address@example.com
email_app_password=your_google_app_password
AUTH_EMAIL_FROM=TripSathi <security@example.com>
RESEND_API_KEY=replace_me
TWILIO_ACCOUNT_SID=replace_me
TWILIO_AUTH_TOKEN=replace_me
TWILIO_FROM_PHONE=replace_me
```

## Data Model Additions

Auth schema includes:

- `role`: `admin` or `user` (default: `user`)
- `refreshTokenHash`: hashed current refresh token for rotation/revocation
- `failedLoginAttempts`: failed login counter (default `0`)
- `lockUntil`: lock expiration datetime after too many failed attempts

User schema includes:

- `authId`: ObjectId reference to the auth document
- `profileCompleted`: profile completion state
- `firstName`, `middleName`, `lastName`
- `age`, `profilePhoto`, `bio`, `location`, `province`, `district`, `landmark`
- `experienceLevel`

## Endpoints

### 1) Signup
- `POST /auth/signup`
- Body:

```json
{
  "phoneNumber": "9876543210",
  "password": "Password@123",
}
```

- Returns user info + `accessToken` + `refreshToken`.
- Also sets `access_token` and `refresh_token` as `httpOnly` cookies with environment-aware security settings.

### 2) Login
- `POST /auth/login`
- Body:

```json
{
  "phoneNumber": "9876543210",
  "password": "Password@123"
}
```

- Returns user info + `accessToken` + `refreshToken`.
- Also sets `access_token` and `refresh_token` as secure httpOnly cookies.

### 3) Profile Completion
- `PATCH /auth/profile`
- Header: `Authorization: Bearer <access_token>`
- Body:

```json
{
  "firstName": "John",
  "middleName": "M",
  "lastName": "Doe",
  "age": 25,
  "profilePhoto": "https://res.cloudinary.com/demo/image/upload/profile.jpg",
  "bio": "I enjoy trekking and travel planning.",
  "location": "Kathmandu",
  "province": "Bagmati",
  "district": "Kathmandu District",
  "landmark": "Near Durbar Marg",
  "experienceLevel": "beginner"
}
```

- Age must be greater than 8.
- Updates the profile stored in the user document.

### 4) Refresh Token
- `POST /auth/refresh`
- Reads `refresh_token` from cookie.
- Returns new `accessToken` and updates `access_token` cookie.
- On invalid or expired token, auth cookies are cleared and `401` is returned.

### 5) Logout
- `POST /auth/logout`
- Header: `Authorization: Bearer <access_token>`
- Clears stored refresh token hash.

### 6) Current User
- `GET /auth/me`
- Header: `Authorization: Bearer <access_token>`

### 7) Admin Protected Route
- `GET /auth/admin-only`
- Header: `Authorization: Bearer <access_token>`
- Requires role: `admin`

### Account verification and recovery

- `POST /auth/verification/request` (authenticated): `{ "channel": "email" }` or `{ "channel": "sms" }`
- `POST /auth/verification/confirm` (authenticated): `{ "challengeId": "...", "code": "123456" }`
- `POST /auth/password/forgot`: `{ "identifier": "email-or-phone" }`; always returns the same response shape
- `POST /auth/password/resend`: `{ "challengeId": "..." }`; replaces a valid password-reset challenge after the 60-second cooldown
- `POST /auth/password/reset`: `{ "challengeId": "...", "code": "123456", "password": "12+ characters" }`

Codes contain exactly six digits and expire after 3 minutes. Each code permits five attempts, requests are limited to five per account and purpose per hour, and replacement codes have a 60-second cooldown. Password reset revokes every refresh session and rejects a code if its registered destination changed after issuance.

If `email` and `email_app_password` are configured, email codes use authenticated SMTP. The Resend email API is the delivery-provider fallback when SMTP credentials are absent and `RESEND_API_KEY` plus `AUTH_EMAIL_FROM` are configured.

Set `AUTH_OTP_TEST_MODE=true` only in local/test environments to return a debug code without contacting a provider. Never enable it in production.

## Guard Strategy

- `JwtAuthGuard`: validates access token from bearer header or `access_token` cookie.
- `JwtRefreshGuard`: validates refresh token from `refresh_token` cookie.
- `RolesGuard`: checks route roles via `@Roles(...)` decorator.

## Anti Abuse Controls

- Login and signup are throttled at 5 requests/minute per IP.
- Failed login attempts are tracked.
- After 5 failed attempts, account is locked for 15 minutes.

## Notes

- Never store refresh token in plain text; only hash is stored in DB.
- For production, use long, random secrets and secure transport (HTTPS).
- You can create admin users by passing `role: "admin"` during signup for now.
