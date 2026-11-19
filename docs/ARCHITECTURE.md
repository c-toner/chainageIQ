# Architecture and delivery plan

## Approach

Next.js App Router serves the UI and authenticated route handlers on Vercel. Supabase supplies cookie-based authentication, PostgreSQL/PostGIS and private object storage. The application uses the user's Supabase session for all normal operations; there is no service-role key in the application. Database row-level policies and narrow transactional functions remain the authority for access and workflow transitions.

React components are grouped by workflow. `src/lib` owns chainage math, validation, permissions, persistence clients and offline drafts. MapLibre is loaded only in the browser. Source records are never silently replaced with demo data; `/demo` is an explicitly read-only fixture. `/` uses real persistence or shows setup instructions.

## Data design

- Organisations → memberships → projects → project memberships.
- Projects → alignments with GeoJSON, PostGIS geometry, chainage bounds and explicit calibration segments.
- Projects/alignments → issues with numeric chainage, optional range, GPS metadata, current assignment and optimistic version.
- Issues → comments, evidence and corrective actions; inspections can link findings to an issue.
- Projects → inspection templates, inspections with versioned JSON checklist responses, approvals and notifications.
- Changes → append-only audit events containing before/after snapshots, actor UUID and server timestamp.
- Invitations store only token hashes; an authenticated, email-verified invitee must match the invited email.

Project IDs are the tenant boundary for child records. Composite foreign keys stop cross-project alignment/issue references. Membership references carry both project and organisation identifiers. Role functions avoid recursive RLS. Historical assignment and inspection responses are retained in audit snapshots rather than separate duplicate history tables.

## Milestones

1. Foundation: application shell, Auth, organisations, projects, role checks and migrations.
2. Chainage: parsing, range validation, calibrated distance segments, issue register and lifecycle.
3. Mapping: GeoJSON import, issue markers, clustering, GPS capture and map selection.
4. Quality: checklist records, corrective actions, independent inspection sign-off, closure approval, quarantined evidence and exports.
5. Field: responsive forms, local draft queue, explicit sync and optimistic issue conflicts.
6. Verification: unit/component tests, real PostGIS policy tests, browser checks, dependency audit and Vercel build.

## Risks and boundaries

- Supabase Auth/Storage and a licensed tile provider need deployment-specific configuration. The application builds without them; live persistence does not operate without Supabase.
- Calibration quality is an engineering responsibility. The GPS projection is a local tangent-plane approximation, not a survey engine. Station equations require explicitly entered calibration segments. Uncalibrated GPS never silently becomes chainage.
- Evidence scanning is deliberately fail-closed. A trusted scanner/administrator must clear quarantined objects before retrieval or issue closure.
- The delivery implements a substantial pilot foundation, not all commercial release requirements. See `IMPLEMENTATION-STATUS.md` for omissions rather than assuming that schema presence means a complete feature.
