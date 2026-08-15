# Photo verification and standalone-place XP policy

Policy version: 1 (2026-08-15)

This policy applies to standalone catalog-place evidence. Campaign evidence continues to use its configured campaign XP rules.

## Submission checks

- The account must be active. A new account must verify either its registered email address or Nepal phone number before submitting evidence.
- The place must be active in the Admin-managed Province → District → Municipality → Place catalog and must have trusted latitude/longitude coordinates.
- The mobile client must submit a current device GPS fix. The server accepts an accuracy of 100 metres or better and a capture time no more than 15 minutes from the server time.
- The server calculates the Haversine distance to the trusted place coordinate. The distance must be within the place-specific Admin radius (default 500 metres; allowed range 50–10,000 metres).
- Evidence must be an HTTPS image in the configured TripSathi Cloudinary account and no larger than 12 MB.
- The backend calculates a SHA-256 fingerprint of the downloaded image. An exact image already pending or approved cannot be reused. This is exact-byte detection, not perceptual-similarity detection.

## Trusted-coordinate backfill

- Existing catalog places without coordinates remain fail-closed and cannot accept standalone evidence.
- Admins can preview coordinate/radius changes with `POST /extra/places/trust-backfill`. The request defaults to `dryRun: true`; previewing never creates or changes hierarchy data.
- Each entry contains `placeId`, `latitude`, `longitude`, and an optional `verificationRadiusMeters` between 50 and 10,000. The default radius is 500 metres.
- After reviewing every returned before/after value, an admin may resend the same validated batch with `dryRun: false`. The backend validates the full batch and saves the hierarchy once.
- Geocoding may suggest coordinates, but a human must confirm them before the apply request. Production radii must be field-tested before enabling evidence for a place.

Example preview body:

```json
{
  "dryRun": true,
  "entries": [
    {
      "placeId": "place_pashupatinath",
      "latitude": 27.7104,
      "longitude": 85.3488,
      "verificationRadiusMeters": 500
    }
  ]
}
```

## EXIF and privacy

EXIF is not treated as proof of presence: metadata can be missing, rewritten, or forged, and image upload services may strip it. TripSathi uses the fresh app-provided GPS fix and trusted catalog coordinate for the server geofence. Moderators should not reject an otherwise valid image merely because EXIF is absent. Uploaded images must not contain private documents, home addresses, or unrelated people without consent.

## Review, rejection, and appeal

- Admin approval rechecks that the place is active and that the stored GPS remains inside its current trusted radius.
- A rejection must include a useful reason. Examples include wrong landmark, unclear/irrelevant image, unsafe/private content, or evidence that cannot be matched to the place.
- A user gets one appeal of a rejected request and must explain why it should be reviewed again. After that decision, the user must submit new evidence.
- The rejected-to-pending appeal transition and appeal counter update occur atomically. Concurrent appeal requests can produce only one successful transition.
- An appeal reuses its original request, photo URL, and evidence hash. It is not a new upload, so its own hash is preserved without bypassing duplicate checks against other submissions.
- Approval and rejection actions are audited. Staff must not approve their own evidence; Admin/Moderator accounts cannot create user evidence requests.
- Appeal submissions are restricted to the User role and are recorded in audit history.

## XP and idempotency

- An approved standalone place visit awards exactly **40 XP** under policy version 1.
- XP is awarded once per normalized District + Municipality + Place for each user, even if a review/API action is retried.
- The XP ledger stores the immutable event key `standalone_place_verified`, rule code `SYS-STANDALONE-PLACE-V1`, request code, place context, and policy version.
- Approval records the district and province visit using the request code as an idempotent visit source. A district becomes visited after one approved place; province completion still requires every district in that province.
- Future XP changes require a new policy/rule version and must not rewrite historical ledger entries.

## Known boundary

Exact hashing does not detect cropped, recompressed, screenshot, or visually similar duplicates. Add perceptual hashing and a moderator similarity view before operating at high fraud volume. GPS can also be spoofed on a compromised device; risk-based device attestation is a later defense, not a reason to trust EXIF.
