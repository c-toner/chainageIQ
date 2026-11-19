# Security and administrator operations

## Trust model

Users authenticate with Supabase Auth. The server verifies each request with `getUser`, and cookie refresh occurs in Next.js Proxy. Route handlers use user sessions; organisation/project membership is enforced again by PostgreSQL RLS. API mutations require a matching Origin. Database workflow functions validate roles and transitions inside transactions; normal users have no direct UPDATE or DELETE grant on issues, audit events, approvals or evidence verdicts.

Administrators manage organisation membership; project managers assign work, engineers/inspectors create field records, and viewers can read. Inspectors/managers/admins may approve issue closure only after clean evidence and completed corrective actions exist. Inspection sign-off additionally requires a different person from the inspection creator. Closing an issue does not require the approver to differ from its creator; add that segregation rule if your contract requires it.

Audits preserve authenticated UUIDs, server timestamps and old/new values. Account identities should be resolved through the administrator's Auth directory. Audit records are append-only for ordinary app users, **not tamper-proof** against database owners or compromised privileged credentials.

## Evidence quarantine

1. User requests an upload token. The server validates MIME type and declared size (up to 10 MB), checks access, creates a quarantined evidence row and signs one storage path.
2. Browser uploads directly to the private bucket. Storage enforces MIME/size restrictions and path ownership. Signed tokens must be treated as short-lived secrets; do not log them.
3. A trusted worker or administrator downloads the object using a separately held privileged credential, checks actual length, magic bytes and MIME, and scans it using an approved malware engine. Declared metadata alone is not proof of file type.
4. Record the scanner version, signature version, object digest and verdict in your restricted operational log. Only set `evidence.scan_status = 'clean'` when the scan succeeds. Use `rejected` on an unsafe file. Missing, timed-out or unavailable scans remain quarantined.
5. Updating the verdict generates an audit snapshot. Privileged scanner events may have a null `actor_id`; retain the worker's identity and correlation ID in the restricted operational log.
6. The app and storage policy allow retrieval only for `clean` rows. Download URLs expire after 60 seconds. Failed uploads can leave metadata without an object: reconcile and remove orphaned entries only through a documented privileged maintenance process after a grace period.

No scanner daemon is bundled. Before a live pilot, implement this worker or appoint a controlled manual process. Never bulk-mark unscanned uploads clean. Private objects should be delivered as downloads or through a sanitising media pipeline if browser rendering is introduced.

## Rate limiting, logs and monitoring

Writes through Next.js use an atomic PostgreSQL per-user, one-minute budget of 60 API write requests. Auth has its own Supabase throttling. Direct Supabase API access remains subject to RLS but does not share this application-route limiter; configure gateway quotas/WAF, storage limits and organisation usage controls before public onboarding. Read quotas and distributed IP controls are deployment responsibilities.

Unexpected API failures emit structured JSON to Vercel logs without sessions or upload tokens. Configure log retention, access controls and alerts in Vercel/Supabase. No external error-monitoring account is provisioned. Do not log descriptions, photos, Auth cookies, connection strings or invitation tokens. Review security headers against your deployment, and add a tested CSP for your selected tile provider before public launch.

## Audit retention and integrity

Set retention with the contractor and asset owner before collecting live records; account for contractual retention and privacy requirements rather than assuming a universal period. Disable routine deletion. Restrict database owner/service credentials to named operators and secret-managed workers. Export audit data daily into separately controlled, versioned/object-locked storage. Compute SHA-256 manifests for each export and verify them during recovery drills. Access to privileged exports and any exceptional deletion requires a recorded ticket, approval and an independent activity log. This external integrity/retention infrastructure is operational setup, not implemented by the web application.

## Backup and restore runbook

- Enable Supabase managed backups and appropriate point-in-time recovery for your plan. Verify the actual retention window. Database backups do not replace object-storage backups.
- Back up the evidence bucket to separately controlled encrypted storage; preserve object keys and a digest manifest. Keep Auth configuration, redirect allowlists, migrations and deployment settings under controlled change management.
- At least before a pilot and periodically thereafter, restore into a separate Supabase project. Apply migrations only as appropriate to the restored schema. Restore evidence objects and compare counts, sizes and digests with manifests.
- Verify two-tenant isolation, sign-in, issue history, approvals and signed evidence access against the restored deployment. Confirm quarantined/rejected files remain inaccessible.
- Record measured recovery-point and recovery-time results, operator identity and discrepancies. Do not claim backup verification until this drill has actually passed. Switch production only with a documented rollback and operator approval.

## Offboarding

Remove project membership and organisation membership using an authorised database operator procedure; the public app has invitation creation/acceptance but no membership-revocation UI yet. Revocation is effective at the database policy layer on subsequent requests. Revoke Auth sessions when necessary. Previously issued clean-evidence URLs remain usable until their short expiry. Local offline drafts persist on the user's device; use managed devices and explicitly clear drafts/storage during offboarding.
