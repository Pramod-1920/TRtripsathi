# TRTripSathi — Backend and Admin Project Documentation

## 1. Document purpose

This document describes the current TRTripSathi system for developers, reviewers, and AI research. It explains the product purpose, architecture, backend modules, admin capabilities, authentication, data flows, implementation status, limitations, and how to run the project.

The repository contains three applications:

| Application | Directory | Responsibility |
| --- | --- | --- |
| Backend API | `backend/` | Authentication, business rules, MongoDB persistence, gamification, trips, campaigns, moderation, and admin APIs |
| Admin dashboard | `Admin/` | Browser-based operations console for admins |
| User client | `Users/` | Flutter mobile/web client consuming the backend API |

This README focuses on the backend and admin applications. It describes code that is present in the repository; a feature marked partial or planned should not be treated as production-complete.

## 2. Product overview

TRTripSathi is a travel and exploration platform intended to let users discover places, create or join trips and campaigns, upload evidence, communicate with other travelers, earn XP, unlock levels/badges/achievements, and build a travel profile.

The admin side gives authorized staff control over users, campaign approval, content and media moderation, Nepal place data, activities, difficulty rules, XP rules, level-up rules, badges, achievements, reviews, reports, and operational analytics.

## 3. Technology and architecture

### Backend

- NestJS 11 and TypeScript
- MongoDB through Mongoose
- JWT access and refresh authentication
- HTTP-only cookies plus bearer-token support
- Role-based authorization (`admin`, `moderator`, `user`)
- Cloudinary signed media uploads
- Redis integration for revocation/rate-limiting support
- Swagger/OpenAPI at `/api/docs`
- Helmet, CSRF protection, request validation, request logging, and rate limiting
- Scheduled campaign lifecycle processing

### Admin

- Next.js 16 and React 19
- TypeScript, Tailwind CSS, Lucide/react-icons, Recharts
- Axios API client with credentials, CSRF header support, and token-refresh retry logic
- Zustand session store
- Route pages under `Admin/app/` and reusable managers under `Admin/components/`

### Runtime flow

```text
Admin browser / Flutter client
        |
        v
Next.js API client or Flutter HTTP client
        |
        v
NestJS controllers -> guards/validation -> services -> Mongoose schemas -> MongoDB
        |
        +-> Redis (revocation/rate limiting where configured)
        +-> Cloudinary (images and media)
```

Default local addresses:

| Service | URL |
| --- | --- |
| Backend | `http://localhost:8080` |
| Admin | `http://localhost:3000` |
| Flutter web | `http://localhost:8081` |
| Swagger | `http://localhost:8080/api/docs` |

## 4. Backend modules and implemented functions

### Authentication and authorization (`auth`)

Implemented:

- Phone-number/password signup and login
- Password hashing with bcrypt
- Access-token and refresh-token generation
- HTTP-only `access_token` and `refresh_token` cookies
- Bearer-token authentication for API clients
- Refresh-token rotation/revocation using a stored hash
- Logout and token revocation
- Current-user endpoint (`GET /auth/me`)
- Admin-only authorization through roles guards
- Failed-login tracking and account lockout behavior
- Auth endpoint rate limiting
- DTO validation for passwords and phone numbers

Main endpoints: `POST /auth/signup`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/admin-only`.

### Users and profiles (`user`)

Implemented:

- Profile creation and editing
- Name, age, email, phone, location, province, district, landmark, bio, profile photo, and experience data
- Profile-completion state
- Public/user search and profile lookup
- User XP history and XP event triggering
- Achievement event triggering
- Referrer assignment and ratings
- Photo-verification request creation
- Admin user listing, search, detail view, profile editing, and deletion
- Admin XP add/simulation/history edit/history delete
- Admin achievement event triggering
- Admin campaign quota updates
- Admin photo-verification review

Main route groups: `/user/profile`, `/user/search`, `/user/:id`, `/user/xp/events`, `/user/achievements/events`, `/user/photos/verification-requests`, and `/user/admin/...`.

### XP, levels, ranks, achievements, and badges

The gamification system is driven mainly by user services and configurable `Extra` records.

- XP event processing and XP ledger/history
- Rule-based XP values and repeat policies
- Conditions for difficulty, activity, district, host status, solo/group status, ratings, and exploration
- Level calculation from total XP
- Rank progression from level
- Rank progress and next-rank information in profile/XP responses
- Achievement progress and reward XP
- Rank-up achievement support
- Admin manual XP corrections with a reason
- Configurable rank badge definitions

The repository also contains dedicated `achievement`, `badge`, and `xp-ledger` modules. The active admin configuration path is primarily `Extra` plus `UserService`.

Default rank bands currently represented by the backend are `F`, `E`, `D`, `C`, `B`, `A`, `S`, `SS`, `SSS`, `Mythic`, and `Heroic`.

### Extra configuration (`extra`)

`Extra` is the admin-configurable catalog for system rules and supporting data. Categories include:

- `places`: provinces, districts, and place catalog data
- `activities`: campaign/activity types
- `difficulty`: difficulty definitions and approval/XP behavior
- `xp`: XP event rules
- `level-up`: level and progression requirements
- `badge`: rank badge definitions and images
- `achievement`: achievement definitions and reward configuration

Implemented admin operations include create, list, detail, update, delete, place hierarchy retrieval, bulk place seeding, and difficulty management. Place seed data is available in `backend/nepal_province_district.json`.

### Trips (`trip`)

Implemented:

- Authenticated trip creation, listing, detail, and updates
- Trip deletion restricted to admins
- Joining trips
- Participant listing
- Check-in
- Admin participant approval
- Admin completion confirmation

### Campaigns (`campaign`)

Campaigns are the main planned travel/activity workflow.

Implemented:

- Campaign creation and editing
- Solo and group hike types
- Scheduled and instant campaign behavior where allowed
- Location, activity, difficulty, duration, cost, participant limit, photos, and join-mode data
- Open-join and request-join flows
- Campaign listing and detail retrieval
- Joining, leaving, and confirming participation
- Participant role changes
- Planning data and task creation/editing
- Phase transitions
- Submit, approve, reject, and verification workflows
- Campaign completion/verification and XP-related lifecycle hooks
- Admin soft-delete to a bin, restore, and permanent delete
- Scheduled lifecycle processing

Main route family: `/campaigns`.

Important rules currently enforced include date ordering, join-window checks, approval status, participant limits, duplicate participation prevention, and restrictions on non-admin instant campaigns.

### Reviews, reports, and moderation

Reviews (`review`) support:

- Rating a participant/user after a trip
- User review lists and statistics
- Reviews given by a user
- Trip review lookup
- Admin review listing, editing, and deletion

Reports (`report`) support:

- Reporting a target
- Open/all report queues
- Report statistics
- Reports by target
- Assigned reports
- Admin assignment
- Admin/moderator status updates

Media (`media`) supports media records and moderation flows, including pending media, moderation statistics, approval, and rejection. User photo verification is handled through user endpoints and the admin photo queue.

### Chat (`chat`)

Implemented chat functions include:

- Person-to-person conversations
- General groups and campaign groups
- Conversation listing and unread counts
- Group detail, add/remove member, and leave group
- Message send, list, edit, delete, mark-read, search, and unread-count operations

### Notifications (`notification`)

Implemented:

- User notification listing
- Unread notification listing and count
- Mark one notification read
- Mark all notifications read
- Delete notification

### Treasure hunts (`treasure-hunt`)

The backend contains a treasure-hunt module for admin hunt creation and authenticated retrieval/progress flows, including hunt lookup by ID and trip association. The admin navigation currently does not expose a complete treasure-hunt management screen, so this area should be considered backend-supported but admin UI coverage is limited.

### Cloudinary and media uploads

Authenticated clients can request Cloudinary upload signatures through `POST /cloudinary/signature`. Admin campaign, badge, and profile screens use signed/direct upload flows for images. Credentials remain server configuration and must not be committed.

### Admin utilities and weather

The backend includes an admin module with weather/geocoding support used by place-management screens. These integrations depend on the external service configuration and network availability.

## 5. Backend security and request behavior

The application currently includes:

- Global `ValidationPipe` with whitelist and non-whitelisted-field rejection
- Global exception formatting through `HttpExceptionFilter`
- CORS configured from comma-separated `FRONTEND_URL`
- Credentials enabled for cookie authentication
- Helmet security headers
- CSRF double-submit cookie protection for state-changing requests
- Auth rate limits: five requests/minute and twenty requests/hour for key auth routes
- Admin security headers middleware
- Request logging middleware
- JWT guards and role guards
- Refresh-token revocation service

Production requirements still include HTTPS, strong unique secrets, a production Redis strategy, credential rotation, startup environment validation, and monitoring.

## 6. Admin dashboard capabilities

### Authentication and session behavior

The admin portal provides:

- Admin login at `/login`
- Cookie-based session handling
- `GET /auth/me` session validation
- Automatic access-token refresh after a 401 response
- CSRF token attachment for state-changing requests
- Rejection/redirect of non-admin users
- Logout and inactivity/session cleanup

### Navigation and pages

| Admin area | Current capability |
| --- | --- |
| Dashboard | User/profile overview and high-level operational statistics |
| Users | Paginated user list, search/filtering, profile detail, editing, deletion, XP history, XP correction, and achievements |
| Photo Queue | Review and approve/reject photo-verification requests |
| Analytics | User growth/profile data plus campaign totals, upcoming/ongoing/open counts, participants, average duration, and top hosts |
| Campaign Add | Create campaign with activity/place/difficulty data, scheduling, participants, media, and campaign rules |
| Campaign Details | View/edit campaign details, participants, planning, tasks, media, and lifecycle actions |
| Campaign Approval | Review submitted campaigns and approve/reject them |
| Campaign Bin | Review deleted campaigns, restore them, or permanently delete them |
| Campaign Reviews | View, update, and delete reviews |
| My Campaign | View campaigns available to the admin user and join where applicable |
| Places | Manage Nepal place hierarchy and place catalog entries |
| Difficulty | Configure difficulty records and approval behavior |
| Activities | Manage activity/extra records used by campaigns |
| XP | Manage XP rules and simulate XP behavior |
| Badge | Manage rank badges and assign badges to profiles |
| Level Up | Manage level-up and progression requirements |
| Achievements | Create, edit, list, and delete achievement definitions |
| Chat | View conversations/messages and search messages |
| Treasure Hunt | Page exists at `/treasurehunt`; backend support exists, but coverage should be verified before treating it as complete |

## 7. Main admin workflows

### New admin setup

1. Start backend and Admin.
2. Log in with an account whose backend role is `admin`.
3. Configure `Extra` data in this order: Places, Activities, Difficulty, XP, Level Up, Badge, Achievement.
4. Review users and photo-verification requests.
5. Review submitted campaigns from Campaign Approval.

### Campaign lifecycle

```text
Create -> Submit -> Admin approve/reject -> Join/request -> Plan/tasks
       -> Campaign window -> Completion/photo verification -> XP/achievement updates
       -> Completed or failed -> Bin/restore/permanent delete (admin)
```

### XP lifecycle

```text
User/admin event -> XP rule matching -> XP ledger -> level/rank calculation
                 -> achievement progress -> reward XP/rank badge visibility
```

## 8. Data model areas

MongoDB schemas currently cover:

- Auth accounts and refresh-token state
- User profiles
- Trips and trip participants
- Campaigns and campaign participants
- Extra configuration/catalog records
- XP ledger/history
- Achievements and rank-up achievements
- Badges
- Reviews
- Reports
- Notifications
- Chat groups and messages
- Visited places
- Treasure hunts and user treasure progress
- Media and photo-verification records

Profiles are separate from authentication records and are linked through `authId`.

## 9. What is built and ready

### Implemented and connected

- Backend compiles through `npm run build`.
- Admin login/session integration is connected to backend auth.
- User/profile administration is connected to backend APIs.
- Campaign creation, listing, details, approval, bin, restore, and lifecycle screens are connected.
- Extra configuration screens are connected for places, difficulty, activities, XP, badges, level-up rules, and achievements.
- Photo-verification queue is connected.
- Analytics page calculates current user and campaign metrics from available API data.
- Backend Swagger documentation is generated from controllers.
- Flutter client has authentication/profile flows that use the same backend.

### Implemented but should be treated as operational/partial

- Treasure-hunt admin coverage is incomplete/needs verification.
- Media moderation APIs/components exist, but the main sidebar does not currently expose a dedicated media page.
- Chat admin UI exists, but full moderation policy and pagination behavior should be tested.
- Redis-backed distributed rate limiting is not guaranteed; an in-memory limiter is used in the bootstrap path.
- External geocoding/weather and Cloudinary flows depend on credentials and network services.

## 10. Known limitations and unfinished work

- OTP phone verification and email verification are not implemented as complete production flows.
- Forgot-password/account-recovery flow is not complete.
- Signup/profile XP copy must match actual server-side XP awards; the signup UI currently claims a reward that is not verified as a transactional backend event.
- Explorer identity selection is currently a UI concept and is not persisted as a full product feature.
- Required profile rules should be enforced consistently on the backend, not only in Flutter.
- The Flutter profile screen is still partly a profile/dashboard hybrid; a dedicated user home dashboard remains future work.
- Automated end-to-end coverage for auth, campaign lifecycle, XP idempotency, media, and admin operations is incomplete.
- Existing lint/analyzer debt remains in parts of Admin and Flutter.
- Production deployment, secrets management, backup/restore, health checks, observability, and CI need formalization.

## 11. Environment configuration

Create `backend/.env` with real local or deployment values:

```env
PORT=8080
MONGODB_URI=mongodb+srv://USERNAME:PASSWORD@HOST/tripsathi
JWT_SECRET=replace_me
JWT_ACCESS_SECRET=replace_me
JWT_REFRESH_SECRET=replace_me
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=http://localhost:3000,http://localhost:8081
CLOUDINARY_CLOUD_NAME=replace_me
CLOUDINARY_API_KEY=replace_me
CLOUDINARY_API_SECRET=replace_me
```

Create `Admin/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Never commit real passwords, JWT secrets, Cloudinary credentials, or production URLs.

## 12. Running locally

### Backend

```powershell
cd backend
npm install
npm run start:dev
```

Useful commands:

```powershell
npm run build
npm test
npm run test:e2e
npm run seed:places
npm run seed:xp
```

### Admin

```powershell
cd Admin
npm install
npm run dev
```

Open `http://localhost:3000`.

### Flutter client

```powershell
cd Users
flutter pub get
flutter run -d web-server --web-port 8081
```

## 13. AI research handoff prompt

Use the following context when asking another AI to research or extend this project:

> TRTripSathi is a full-stack travel-engagement platform. The NestJS backend in `backend/` is the source of truth for authentication, users/profiles, trips, campaigns, campaign participants, places, activities, difficulty, XP, levels, ranks, achievements, badges, reviews, reports, notifications, chat, media/photo verification, visited places, and treasure hunts. MongoDB is accessed through Mongoose. Authentication uses JWT access/refresh cookies, bearer-token support, CSRF protection, validation, rate limiting, and role guards. The Next.js admin dashboard in `Admin/` consumes these APIs and provides admin login, user/profile management, campaign creation/details/approval/bin, analytics, photo verification, reviews, chat, and Extra configuration screens for places, activities, difficulty, XP, level-up rules, badges, and achievements. Before proposing changes, inspect the actual controllers, DTOs, services, schemas, and admin API calls. Treat the “implemented but partial” and “known limitations” sections of this README as important constraints. Use Swagger at `/api/docs` for the generated API contract and distinguish code that exists from features that are fully tested and production-ready.

## 14. Source-of-truth locations

- Backend composition: `backend/src/app.module.ts`
- Backend bootstrap/security: `backend/src/main.ts`
- Backend controllers/services/schemas: `backend/src/<module>/`
- Admin routes: `Admin/app/`
- Admin reusable managers: `Admin/components/`
- Admin API helpers: `Admin/lib/`
- Authentication notes: `backend/src/auth/AUTH_README.md`
- Seed scripts: `backend/scripts/`
- Admin-specific guide: `Admin/README.md`
