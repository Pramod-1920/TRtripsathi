# TripSathi Campaign System

## 1. Purpose

The Campaign system lets a traveler organize a solo or group trip, publish or privately share it, coordinate participants, complete the trip, submit evidence, and receive XP.

This document describes the behavior currently implemented in the Flutter user application and NestJS backend. It also records the system's limits, business value, operational risks, and recommended improvements.

## 2. Main campaign types

| Type | Purpose | Start rule | Participants |
| --- | --- | --- | --- |
| Instant solo | A spontaneous trip beginning today | Starts immediately after publishing | Host only |
| Scheduled solo | A solo trip planned in advance | At least 2 days from the current time | Host only |
| Scheduled group | A campaign other travelers can join | At least 9 days from the current time | Configurable minimum and maximum |

An instant group campaign is not allowed. An instant solo campaign lasts 12 hours. Scheduled campaigns use the start date, end date, and duration chosen by the host.

## 3. Campaign creation flow

The mobile creation wizard has four stages.

### 3.1 The idea

The host provides:

- a title;
- a description of at least 20 characters in the current mobile UI;
- an Admin-managed activity category and optional subcategory;
- solo or group trip type;
- an optional cover image.

The cover image is uploaded to Cloudinary before the campaign payload is sent to the backend.

### 3.2 The place

The host selects or enters:

- province;
- district;
- municipality, when applicable;
- destination, place, or trail name.

The backend builds a display location from these fields when a separate location value is not provided.

### 3.3 The plan

The host configures:

- instant or scheduled mode for solo travel;
- start date and time for scheduled travel;
- duration for scheduled travel;
- difficulty;
- estimated budget in NPR;
- group join mode;
- public or private visibility;
- gender audience;
- minimum and maximum participant counts.

Current group settings are:

| Setting | Options | Meaning |
| --- | --- | --- |
| Join mode | Open join | An eligible traveler is accepted immediately |
| Join mode | Host approval required | The traveler is stored as pending |
| Visibility | Public | Eligible travelers can discover the campaign |
| Visibility | Private | Hidden from discovery; requires an invite code |
| Gender audience | All genders | Visible and joinable by every gender profile |
| Gender audience | Men only | Visible and joinable only by profiles recorded as `male` |
| Gender audience | Women only | Visible and joinable only by profiles recorded as `female` |

Gender audience and private/public visibility apply to group campaigns. Solo campaigns are normalized to `all` and `public` because they do not accept participants.

### 3.4 Review and publish

The review screen summarizes the destination, schedule, trip length, budget, participant range, gender audience, and visibility.

When published, the backend:

1. validates the category, trip type, timing, participant range, and other DTO fields;
2. verifies whether the selected difficulty requires Admin approval;
3. checks the host's annual campaign quota;
4. creates a unique campaign code;
5. creates the lifecycle timeline;
6. initializes planning, verification, participant, and audit state;
7. saves the campaign and returns it to the app.

## 4. Campaign codes and private campaigns

Every newly created campaign receives a unique code in this format:

```text
#A1B2C3
```

The `#` is a fixed prefix. The following six characters are randomly selected from `A-Z` and `0-9`. This provides approximately 2.18 billion possible suffixes (`36^6`). The database also has a unique constraint, and generation retries if a collision occurs.

For a private group campaign:

- it is omitted from normal campaign discovery;
- a non-host cannot retrieve it through the normal campaign-ID endpoint;
- the host sees the invite code on their trip card;
- an invited traveler enters the code through the key icon on the Campaigns screen;
- the backend normalizes lowercase input and accepts input with or without the leading `#`;
- code search returns only a matching private campaign;
- gender rules are checked before the private campaign is revealed;
- the same code must be supplied again when the traveler joins.

The invite code is therefore enforced by the backend, not only by the mobile interface.

Private does not override other campaign rules. A private campaign must still be approved, open for enrollment, within capacity, in the correct lifecycle phase, and compatible with the traveler's gender profile.

## 5. Public campaign discovery

Campaign discovery requires an authenticated account. The backend returns approved group campaigns that:

- are public, or are older campaigns without a visibility field;
- have reached their discovery/join date;
- match the viewer's gender when a gender restriction exists;
- have not been deleted by Admin.

The host can still see their own campaigns through the separate “My campaigns” query, including private campaigns. Admin listings can see campaigns regardless of public/private or gender settings.

Users with `non_binary`, `other`, `prefer_not_to_say`, or no recorded gender see all-gender campaigns but do not see men-only or women-only campaigns.

## 6. How a traveler joins

### 6.1 Public campaign

1. The traveler opens the Campaigns screen.
2. The backend returns only campaigns they are eligible to discover.
3. The traveler selects Join.
4. The backend repeats all permission and eligibility checks.
5. With open join, the traveler becomes accepted immediately.
6. With approval-required join, the traveler becomes pending.

### 6.2 Private campaign

1. The host shares the invite code outside or inside the app.
2. The traveler opens Find private campaign using the key icon.
3. The traveler enters a code such as `#A1B2C3`.
4. The backend validates the format, privacy type, campaign existence, and gender eligibility.
5. The app shows a preview.
6. The traveler chooses Join.
7. The app sends both the campaign ID and invite code.
8. The backend validates the code again and processes the join.

### 6.3 Join checks performed by the backend

A join is rejected when:

- the campaign does not exist or was deleted;
- a private campaign code is missing or invalid;
- the campaign is not approved;
- the traveler's recorded gender does not match the campaign restriction;
- the campaign is completed, cancelled, failed, or awaiting completion evidence;
- the lifecycle is not `open`;
- participants are locked;
- enrollment has not opened or has already closed;
- the traveler is the host;
- the traveler is already accepted or pending;
- the maximum participant count has been reached.

A traveler can leave a campaign. Their participant status becomes `left`, their confirmation is cleared, and planning costs are recalculated.

## 7. Participant roles and confirmation

Participant roles are:

- `host`;
- `co-host`;
- `member`.

Participant membership statuses are:

- `pending`;
- `accepted`;
- `rejected`;
- `left`;
- `removed`.

Accepted participants can confirm participation. Before a campaign moves from ready to started, the automated lifecycle checks whether every accepted participant is confirmed. If confirmation is missing, participants are notified and the system checks again two hours later.

## 8. Group campaign lifecycle

The normal lifecycle is:

```text
draft -> open -> planning -> verification -> ready -> started -> completed
   \        \          \              \         \          \
    ------------------------------------------------------> cancelled
```

### Draft

The campaign is waiting for approval or initial publication. A difficulty configured by Admin as approval-required produces `approvalStatus: submitted`. Other difficulties are auto-approved.

### Open

Eligible travelers can join. At the end of this phase, the campaign is cancelled if accepted participants are below the minimum; otherwise it moves to planning.

### Planning

The group completes:

- transport decision;
- meeting point;
- meeting time;
- transport, food, guide, and miscellaneous cost fields;
- at least one task;
- an assignee for each task.

Costs are totaled automatically and divided by the active participant count. If planning is incomplete at the scheduled transition, participants are notified and the system retries after six hours.

If the host is inactive in planning for 48 hours, the system sends a reminder. After two reminder cycles without activity, the campaign is automatically cancelled.

### Verification

Participants are locked and planning waits for Admin verification. If approval is still pending, the system notifies participants and retries after six hours. Admin can approve the campaign or reject it back to planning with a reason.

### Ready

The final participant list is prepared and confirmations are checked. Once all accepted participants are confirmed and the scheduled start is reached, the campaign starts.

### Started

The trip is underway. The end is calculated from the explicit end date or from the start date plus duration.

### Completed and evidence window

At the trip end, the system opens a 24-hour evidence window. The host must upload one image or video. The mobile app supports images and videos up to two minutes for this flow.

Evidence must:

- use HTTPS;
- be hosted on Cloudinary;
- match the declared image or video resource type;
- use the TripSathi `campaign_verification` upload folder;
- be submitted before the deadline.

After valid evidence is submitted, the backend automatically:

- marks the host as verified;
- stores the evidence URL, public ID, media type, and optional caption;
- closes the evidence window;
- awards host completion XP;
- awards completion XP to accepted participants;
- records achievement progress;
- applies eligible first-district and referral rewards;
- records verified district and province visits;
- writes an audit event.

If no evidence is uploaded within 24 hours, the campaign is saved as cancelled with the reason “No completion evidence uploaded within 24 hours.” No completion XP is awarded.

## 9. Solo campaign lifecycle

Scheduled solo campaigns must begin at least two days after creation. Instant solo campaigns start at the server's current time and last 12 hours.

Instant solo is not available when the selected difficulty requires Admin approval, because the approval delay would conflict with immediate travel.

Solo campaigns do not accept participants. Their visibility and gender settings are normalized to public/all. They still use completion evidence and the 24-hour XP verification window.

## 10. Automatic processing

A scheduler runs campaign housekeeping every five minutes. Housekeeping performs:

- trip-end detection;
- opening and expiring completion-evidence windows;
- approval-status normalization;
- rejection of campaigns that can no longer be approved in time;
- lifecycle transitions;
- planning inactivity reminders and cancellation.

Some read endpoints also invoke housekeeping. As a result, state can update when a user refreshes, but scheduled transitions may normally appear up to roughly five minutes after their exact deadline.

## 11. Current limits

### Creation limits

- The backend intends to give a normal user five campaign creations per UTC calendar year. The current quota lookup uses the host identifier as a profile document ID; this mapping must be audited because most profile operations use `authId`. If those IDs differ, quota enforcement may not run reliably.
- The quota resets to five on the first creation attempt in a new UTC year.
- Admin creation bypasses the quota.
- Scheduled solo requires at least two days of lead time.
- Group requires at least nine days of lead time.
- Group instant mode is forbidden.
- Instant solo lasts 12 hours.
- The mobile UI restricts group maximum participants to 30, but the campaign backend currently does not enforce the same upper bound. This is a known validation gap.
- The mobile UI restricts scheduled duration to 1-30 days, but equivalent maximum enforcement should also be added to the backend.

### Privacy and gender limits

- Private codes have six random characters after `#`.
- Codes cannot currently be rotated, revoked, or regenerated by the host.
- Codes do not expire independently of the campaign.
- Anyone receiving a forwarded code can attempt access.
- Gender eligibility depends on self-reported profile data.
- Men-only and women-only are binary choices; other gender profiles can join only all-gender campaigns.
- The feature controls app visibility and joining, but it cannot guarantee a person's real-world identity.

### Joining limits

- There is no campaign waitlist when capacity is full.
- Approval-required joins are stored as pending, but a complete host-facing accept/reject workflow is not yet exposed for campaign participants. Until that is implemented, request-mode campaigns can leave users stuck in pending state.
- Participant removal and status moderation need a complete host UI.

### Completion limits

- Evidence validation confirms storage origin and media type; it does not understand whether the photo/video actually proves the traveler visited the destination.
- Only the host submits completion evidence for the campaign. Individual participant proof is not collected.
- A valid host submission currently awards eligible accepted participants automatically, even if one participant did not actually attend.
- Video uploads depend on network speed, Cloudinary limits, and device storage/memory.
- XP and related side effects span several database operations and should eventually use stronger transaction/idempotency handling for partial-failure recovery.

## 12. Advantages

### User advantages

- Supports both spontaneous solo travel and carefully planned groups.
- Gives groups enough lead time for enrollment, planning, verification, and confirmation.
- Lets travelers choose public discovery or controlled invite-only access.
- Adds comfort-oriented gender audience choices.
- Prevents client-side bypass by enforcing privacy, code, capacity, lifecycle, and gender rules in the backend.
- Provides cost sharing, task assignment, participant roles, confirmations, notifications, audit history, XP, achievements, and visited-place tracking.
- Cancels abandoned or unverified campaigns automatically instead of leaving misleading completed records.

### Platform advantages

- More campaign creation and group participation can improve retention.
- XP, achievements, ranks, and travel history encourage repeat engagement.
- Private campaigns support schools, workplaces, clubs, families, and friend groups.
- Structured campaign data can improve destination recommendations and safety operations.
- Audit logs and explicit lifecycle states make moderation and support easier.

## 13. Profit and business opportunities

No direct campaign monetization is currently implemented. The following are potential revenue opportunities, not existing functionality:

- premium campaign creation beyond the annual free quota;
- featured or promoted public campaigns;
- organizer subscriptions with more participants, analytics, or reusable templates;
- a booking or service fee for guides, transport, stays, permits, or equipment;
- affiliate revenue from hotels, insurance, outdoor equipment, and local services;
- paid identity or organizer verification;
- sponsored destinations and tourism-board campaigns;
- private campaign packages for companies, schools, and travel clubs;
- cancellation protection or travel insurance commissions.

Profit depends on balancing revenue with moderation, payment fees, customer support, refunds, insurance, legal compliance, Cloudinary usage, notification delivery, and infrastructure costs.

## 14. Problems and risks we may face

### Safety and trust

- A campaign host may provide misleading information or organize an unsafe route.
- Uploaded evidence may be old, unrelated, edited, or copied.
- Participants may confirm and later fail to attend.
- Private codes can be forwarded to unintended people.
- Gender restrictions may create discrimination complaints or conflict with local laws and app-store policies.
- The platform needs reporting, blocking, emergency guidance, organizer reputation, and clear terms of service.

### Security and privacy

- A six-character code is convenient but should be treated as an invitation, not a high-security secret.
- Code-search and join endpoints need strict rate limiting and monitoring to reduce brute-force attempts.
- Gender and travel schedule are sensitive personal data and should be minimized in logs and analytics.
- Exact meeting points and times should not be shown before a traveler is accepted.
- Cloudinary public URLs can be reshared unless stronger access controls are introduced.

### Technical reliability

- Scheduler or server downtime can delay transitions and cancellations.
- Time-zone misunderstandings can cause users to perceive a start or deadline as incorrect; the server uses absolute timestamps while the app displays local time.
- Poor connectivity can cause image/video uploads to fail near the evidence deadline.
- Parallel join requests near capacity require careful atomic handling to prevent overbooking.
- Multi-step XP awarding can partially succeed if a downstream operation fails.
- Database and Cloudinary failures after quota deduction can leave a user with a reduced quota even if creation is not fully completed.
- Legacy campaigns may contain old code formats or missing visibility/gender fields and require migration if rules become stricter.

### Product and moderation

- Admin verification can become a bottleneck as campaign volume grows.
- Hosts may abandon planning despite reminders.
- Users can misunderstand “private” as a guarantee of personal safety.
- Binary audience filters do not cover every identity or preference.
- Too many restrictions can reduce the number of campaigns visible to a user and make the marketplace feel empty.
- Monetization introduced too early could encourage low-quality or spam campaigns.

## 15. Recommended next improvements

1. Add a complete host UI and endpoint for accepting or rejecting pending join requests.
2. Make capacity reservation atomic to prevent concurrent overbooking.
3. Add invite-code rotation, revocation, expiration, attempt throttling, and audit events.
4. Add copy/share controls for private invite codes.
5. Add a waitlist and automatic promotion when an accepted participant leaves.
6. Require individual attendance confirmation or evidence before awarding each participant XP.
7. Add EXIF/location checks, duplicate-image detection, or Admin review for suspicious evidence while preserving privacy.
8. Use transactions or an outbox/idempotency model for XP, achievements, referrals, visits, notifications, and audit events.
9. Enforce mobile limits such as maximum participants and duration in the backend DTO/service.
10. Add campaign reporting, user blocking, host ratings, emergency contacts, and safety check-ins.
11. Add migrations for legacy campaign codes and missing privacy/gender defaults.
12. Add automated tests for timing boundaries, private-code access, gender visibility, capacity races, evidence deadlines, and XP idempotency.

## 16. Current implementation locations

The main backend implementation is in:

- `backend/src/campaign/campaign.controller.ts`
- `backend/src/campaign/campaign.service.ts`
- `backend/src/campaign/campaign.scheduler.ts`
- `backend/src/campaign/schemas/campaign.schema.ts`
- `backend/src/campaign/dto/create-campaign.dto.ts`
- `backend/src/campaign/dto/lifecycle.dto.ts`
- `backend/src/campaign/dto/verify-campaign-completion.dto.ts`

The main mobile implementation is in:

- `Users/lib/features/trips/presentation/pages/create_trip_wizard.dart`
- `Users/lib/features/trips/presentation/pages/trips_page.dart`
- `Users/lib/features/campaigns/presentation/pages/campaigns_page.dart`
- `Users/lib/features/campaigns/presentation/providers/campaigns_provider.dart`
- `Users/lib/features/campaigns/domain/campaign_lifecycle.dart`
- `Users/lib/core/networking/api_service.dart`

## 17. Summary

The Campaign system now supports instant and scheduled solo travel, nine-day-ahead group planning, public and code-protected private campaigns, gender-based discovery, open or requested joining, lifecycle planning, Admin verification, participant confirmation, completion evidence, automatic cancellation, and XP rewards.

Its strongest qualities are backend-enforced eligibility, structured lifecycle automation, flexible privacy, and engagement rewards. Its most important remaining work is join-request moderation, stronger invite security, attendance verification per participant, atomic capacity/XP processing, and safety/compliance controls.
