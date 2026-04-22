# Admin Section Updates

This file summarizes the latest Admin section updates that were implemented.

## Authentication and Access Control

- Admin login page is now sign-in only.
- "Create account" / signup UI was removed from the admin app.
- Backend now blocks creating new admin accounts via signup.
- Existing admin accounts can still sign in normally.

## Admin Profile Management

- Added a dedicated My Profile page at `/profile`.
- Added My Profile navigation link in the sidebar.
- Admin can edit own profile details from the admin panel.

## DOB and Auto Age Calculation

- Manual age editing was removed from My Profile.
- Added Date of Birth field.
- Age is now auto-calculated from DOB.
- Backend validates DOB and rejects invalid ages outside safe range.

## Profile Picture Upload, Crop, and Preview

- Removed profile picture URL text input.
- Added local device image file selector.
- Added crop controls (zoom, horizontal position, vertical position).
- Added selected-image preview and cropped-image preview.
- Cropped image is uploaded securely to Cloudinary using backend-generated signed parameters.

## Safe Image Lifecycle

- Backend stores both profile image URL and Cloudinary public ID.
- When profile image changes, previous Cloudinary image is deleted automatically.
- When account/profile is deleted, linked profile image is also removed.
- Cloudinary signature endpoint now requires authenticated user access.

## Navbar Profile Image

- Header/navbar now shows admin profile image when available.
- After saving a new profile image, navbar image updates to the latest image.

## Security and Data Integrity

- Backend profile updates now sanitize allowed fields.
- Unknown or unsafe fields are ignored.
- Age cannot be directly injected through profile update payloads.

## Files Touched (Key)

- `Admin/app/profile/page.tsx`
- `Admin/components/sidebar.tsx`
- `Admin/components/header.tsx`
- `Admin/lib/auth-store.ts`
- `Admin/app/login/page.tsx`
- `backend/src/user/schemas/user.schema.ts`
- `backend/src/user/dto/update-profile.dto.ts`
- `backend/src/user/user.service.ts`
- `backend/src/user/user.module.ts`
- `backend/src/config/cloudinary/cloudinary.controller.ts`
- `backend/src/config/cloudinary/cloudinary.service.ts`
- `backend/src/auth/auth.service.ts`
