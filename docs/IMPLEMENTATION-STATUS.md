# Implementation status

## Implemented

- Next.js application, Vercel configuration, strict TypeScript, responsive navigation, dashboard, register, map, timeline, inspections, actions, audit, reports and administration.
- Supabase email-link sign-in, verified sessions, organisation bootstrap, project creation, expiring email-bound invitation tokens and five roles.
- PostgreSQL/PostGIS migrations, RLS, composite scope constraints, geometry index, transactional issue lifecycle, optimistic conflicts, approval records and audit snapshots.
- Numeric chainage, ranges/offsets, GeoJSON import, calibrated GPS projection with explicit segment discontinuities, captured accuracy and source labels.
- MapLibre markers, clustering, alignment overlays, endpoint labels, GPS control, location selection and configurable street/satellite styles.
- Issue creation, assignment and status updates; evidence uploads, quarantine-gated signed downloads, comments, corrective actions and basic checklist submissions/independent approval.
- CSV/PDF exports and filters; category/severity summaries and inspection approval totals.
- IndexedDB issue drafts, explicit retry, idempotent UUIDs and visible confirmation/errors.
- Read-only fixture demo and separate database-backed demonstration seed script.
- Unit/component tests, database isolation/workflow integration tests, desktop/mobile demo browser tests and GitHub Actions.

## Requires external configuration

- Supabase database migrations, Auth project/SMTP/redirects and private Storage.
- Licensed basemap style URLs and browser-key restrictions; satellite requires a satellite style URL.
- Trusted malware scanning worker or controlled manual quarantine review.
- Vercel project creation/environment variables and deployment; no deployment has been performed automatically.
- Production monitoring alerts, usage quotas/WAF, backup retention, object backups and restore drills.

## Remaining product work before a broader commercial rollout

- Full editing/archival of projects and alignments, issue metadata editing and membership removal UI. Current issue updates cover lifecycle, assignment, resolution and review notes. Records are not destructively deletable in the UI.
- Fully configurable workflow definitions and organisation-specific role/approval rules.
- Inspection-template editor, multi-question template selection, scheduled inspection lifecycle, recurring inspections and resubmission UX. The schema supports templates; the current form captures one checklist question per submitted inspection.
- Dedicated NCR numbering/register beyond the issue category and corrective-action link.
- Notifications delivery/read UI, assignment notifications, full assigned-work dashboard and historical closure-trend charts.
- Resumable evidence upload, scanner automation, file hashes in application records, download access auditing and richer resolution-evidence categorisation.
- Full offline application shell, queued photo uploads, encrypted device drafts, offline editing/merge UX and background sync.
- Large-dataset pagination, server-side spatial searches, richer chainage labels, map drawing beyond point selection, measured performance/load testing and validated long-distance geodesic projection.
- Unicode font embedding in PDF (the current standard-font report replaces unsupported characters), enhanced report layout and contractual report templates.
- External penetration testing, comprehensive accessibility audit, commercial tenancy/retention policy, operational restore verification and deployment-specific CSP.

## Verification interpretation

Database integration tests execute the actual migrations and policies in PostgreSQL/PostGIS with minimal Supabase-compatible Auth/Storage table fixtures. They verify database isolation and workflows, but do not replace staging tests against real Supabase Auth email delivery, signed Storage APIs and a deployed Vercel environment.

Browser tests cover the setup page and labelled demo on desktop and mobile, including filtering, details and timeline interactions. They do not claim that a real user's email sign-in or a real upload/scan/closure was exercised against an external account. See `VERIFICATION.md` for recorded local results.
