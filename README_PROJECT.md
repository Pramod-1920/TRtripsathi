TRtripsathi — Project Summary and Recent Changes

Overview

TRtripsathi is a full-stack application that manages user profiles, campaigns (group and solo trips), and an admin dashboard for campaign creation, approval, and analytics. The project contains a Next.js admin panel (`Admin/`), a backend (NestJS under `backend/`) and a Flutter mobile client (`Users/`). The admin UI includes pages to create and manage campaigns, review approvals, and inspect analytics.

Purpose of this README

This document explains what was implemented and the notable recent fixes made to the admin UI and campaign logic.

Recent changes (May 2026)

1) Campaign creation (admin)
- File updated: `Admin/app/campaigns/add/page.tsx`
- Behavior changes:
  - When campaign type (`hikeType`) is `solo`:
    - The "Join Mode" field is hidden since solo campaigns don't require join flows.
    - Duration (days) becomes read-only and is auto-calculated from the selected start and end date/time.
    - The request payload sent to the backend omits `joinMode` for solo campaigns.
  - For `group` campaigns the existing behavior remains: join mode selectable (open/request), participant limits required, and schedule type forced to "scheduled".
- Rationale: solo campaigns are simpler, typically host-less or instant style trips. Auto-calculating duration reduces user error and avoids inconsistencies between dates and duration.

2) Campaign listing (admin: My Campaign page)
- File updated: `Admin/app/my-campaign/page.tsx`
- Behavior changes:
  - The page now filters out closed campaigns (those marked `completed` or `failed`) and campaigns whose `endDate` is in the past. Only open or upcoming campaigns are shown to users.
  - The listing logic was updated to prevent a render-time lint warning by inlining the async fetch within `useEffect`.
- Rationale: users expect to see actionable campaigns (open/upcoming). Closed campaigns were cluttering the list.

3) Analytics & Reports (admin)
- File updated: `Admin/app/analytics/page.tsx`
- Enhancements:
  - The analytics page now fetches campaign data using `fetchCampaigns` and computes campaign-related metrics:
    - Total campaigns, Upcoming, Ongoing, Open-for-join counts
    - Total participants (accepted participants)
    - Average campaign duration (days)
    - Top hosts (by number of campaigns created)
  - Existing profile analytics (user growth, signups, experience distribution) remain.
  - Visual elements updated: StatCards show campaign metrics and the "Top Stats" section displays Top Hosts and updated Key Metrics.
- Rationale: the admin dashboard benefits from campaign-focused insights to monitor activity and participation.

Notes on implementation details and caveats

- Image elements in the admin UI still use `<img>` tags in some places and Next.js linter warns about replacing with `next/image` for better LCP and optimization. This is a low-risk improvement you can apply later.

- The analytics computations use a `referenceNow` timestamp set when the analytics data is loaded. This keeps computed charts stable during a single load. Ensure the backend `createdAt`, campaign `startDate` and `endDate` values are valid ISO strings.

- Backend behavior is unchanged: the server continues to enforce validity for `startDate`/`endDate` and campaign lifecycle rules. If you want stricter server-side enforcement (e.g., ignoring `joinMode` for solo campaigns), we can add that to `backend/src/campaign/campaign.service.ts`.

How to run locally (Admin)

- From project root, install dependencies and run the admin app (Next.js):

  # from Admin/
  npm install
  npm run dev

- Backend (NestJS) should be started separately (see `backend/README.md`).

Testing the changes

- Create a solo campaign via the admin Create Campaign form and observe:
  - Join Mode field hidden
  - Duration becomes read-only and value updates when you pick start and end dates
  - On submit, payload excludes `joinMode`

- Browse "My Campaign" page: closed or ended campaigns should not appear.

- Open Analytics page: you should see new cards for campaign counts and Top Hosts.

Next steps and optional improvements

- Replace `<img>` with `next/image` for better performance.
- Server-side: enforce campaign payload rules (ignore joinMode for solo, compute duration if missing).
- Add more charts (time series for participants, campaign lifecycle funnel) and CSV export for reports.
- Add toggle on the My Campaign page to show/hide closed campaigns for auditing purposes.

If you want, I can make the server-side change(s) and/or replace images with Next's Image component and update the tests/linters.

---
This README was generated automatically in the editing session; update it with additional project-specific documentation or links as needed.
