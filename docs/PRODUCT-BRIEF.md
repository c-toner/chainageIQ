# ChainageIQ — Product Design & Implementation Brief

## Objective

Design and implement **ChainageIQ**, a production-oriented, multi-tenant SaaS platform for managing infrastructure issues, defects, inspections, non-conformances and audit records along linear civil infrastructure projects.

Target users include civil contractors, site engineers, supervisors, project managers, quality inspectors and asset owners working on roads, rail, drainage, pipelines and utilities.

Build a polished, mobile-first application suitable for field operations and management reporting.

**Do not build a static prototype. Implement a working full-stack application with persistent data, authentication, secure APIs and automated tests.**

## 1. Recommended Technology Stack

- Frontend: Next.js, React, TypeScript, Tailwind CSS and shadcn/ui.
- Backend: Next.js server-side APIs and services.
- Database: PostgreSQL with PostGIS.
- Authentication: Supabase Auth.
- File storage: Supabase Storage with private buckets.
- Mapping: MapLibre GL JS with a properly licensed map tile provider.
- Validation: Zod.
- Testing: Vitest, React Testing Library and Playwright.
- Deployment: Vercel and Supabase.
- CI/CD: GitHub Actions.

Use clean architecture, reusable components, strict TypeScript and maintainable code.

## 2. Core Features

### Project and Organisation Management

- Multi-tenant organisations with strict data isolation.
- Projects with names, descriptions, locations and chainage boundaries.
- Multiple alignments per project.
- User invitations and role-based permissions.
- Roles: Organisation Admin, Project Manager, Engineer, Inspector and Viewer.
- Project dashboards and activity summaries.

### Chainage Management

- Support chainage notation such as CH 0+000, CH 1+250 and CH 12+450.
- Store chainage internally as numeric distances in metres.
- Support start and end chainages for issues covering a range.
- Support lateral offsets, alignment IDs and configurable chainage origins.
- Validate chainages against the selected alignment.
- Allow manual chainage entry and GPS-assisted location capture.
- Import GeoJSON alignments.
- Calculate chainage from geographic positions only when a valid, calibrated alignment exists.
- Handle chainage equations and discontinuities explicitly rather than assuming all alignments use continuous stationing.

### Interactive Map

Build a fully interactive geographic map supporting:

- Street and satellite basemaps.
- Road and infrastructure alignment overlays.
- Colour-coded issue markers.
- Marker clustering.
- Clickable issue details.
- Drawing and selecting locations.
- Current GPS position.
- Filtering by project, priority, status and chainage range.
- Map-to-register and register-to-map navigation.
- Chainage labels along alignments.

GPS-derived locations must be clearly distinguished from surveyed or manually verified chainages.

### Issue and Defect Management

Each issue must support:

- Unique issue reference.
- Project and alignment.
- Chainage start/end and offset.
- GPS coordinates.
- Category and severity.
- Title and description.
- Status and assigned owner.
- Due date.
- Photos, documents and other evidence.
- Comments and activity history.
- Corrective actions.
- Resolution evidence.
- Review and closure approval.

Support configurable workflows such as:

Open → Assigned → In Progress → Ready for Review → Closed.

Allow reopening with a mandatory reason.

### Inspections and Auditing

- Configurable inspection checklists.
- Scheduled and ad hoc inspections.
- Pass/fail/not-applicable responses.
- Inspection findings linked to issues.
- Non-conformance records (NCRs).
- Corrective action tracking.
- Reviewer approval and sign-off.
- Timestamped audit history.
- Evidence attachments.
- PDF and CSV exports.
- Reports filtered by project, chainage range, category, status and date.

Preserve the identity of the person performing each action. Use server-generated timestamps and retain historical versions of significant changes.

### Dashboard and Reporting

Provide:

- Total open and closed issues.
- Overdue corrective actions.
- Issues by severity and category.
- Issues by alignment and chainage range.
- Inspection completion rates.
- Closure trends.
- Assigned work.
- Recent activity.
- Exportable issue registers and audit reports.

Include a visual chainage timeline showing the position and extent of issues along an alignment.

### Field Experience

- Responsive desktop, tablet and mobile interfaces.
- Camera capture and photo uploads.
- GPS location capture with accuracy metadata.
- Fast issue creation with minimal typing.
- Clear loading, error and success states.
- Accessible forms and navigation.
- Offline issue drafting and queued synchronisation, with conflict handling and visible sync status.

Do not claim records are synchronised until the server confirms persistence.

## 3. Security and Reliability

Implement:

- Server-enforced organisation and project access controls.
- PostgreSQL Row Level Security where appropriate.
- Secure authentication and session management.
- Strict input validation and API authorisation.
- Private evidence storage with short-lived signed access.
- File type and size restrictions.
- Malware scanning integration or a documented quarantine workflow.
- Rate limiting.
- Audit logging for privileged and business-critical actions.
- Protection against cross-tenant access.
- Secure environment variable management.
- Database migration scripts.
- Backup and restore procedures.
- Structured logging and error monitoring.
- Automated security and dependency checks.

Audit records must be append-only for normal application users. Define retention, privileged access and integrity verification controls. Do not describe audit records as tamper-proof without evidence.

## 4. UI/UX Requirements

Create a premium, modern B2B SaaS interface.

Design inspiration: Linear, Vercel and contemporary GIS dashboards.

Use a professional visual style with strong readability, restrained colours, clear severity indicators and excellent mobile usability.

Main navigation:

1. Dashboard
2. Projects
3. Interactive Map
4. Chainage Timeline
5. Issues & Defects
6. Inspections
7. Corrective Actions
8. Audit Trail
9. Reports
10. Administration

Prioritise efficient workflows for site supervisors wearing gloves and working outdoors.

## 5. Database Design

Design a relational schema covering:

- organisations
- users and memberships
- projects
- project memberships
- alignments and alignment geometries
- chainage calibration/equations
- issues
- issue assignments
- issue history
- evidence attachments
- inspections
- inspection templates
- inspection responses
- corrective actions
- approvals
- audit events
- notifications

Include appropriate indexes, foreign keys, tenant-scoping constraints and PostGIS spatial indexes.

## 6. Engineering Deliverables

Provide:

- Complete application source code.
- Database schema and migrations.
- Secure authentication and authorisation.
- Fully functional interactive map.
- Working CRUD workflows.
- Evidence upload and retrieval.
- Inspection and approval workflows.
- Audit trail and reporting.
- Seeded demonstration environment.
- Unit, integration and end-to-end tests.
- Environment variable template.
- GitHub Actions CI pipeline.
- Vercel deployment configuration.
- Developer documentation.
- Administrator and user documentation.
- Security assumptions and known limitations.

## 7. Implementation Approach

Work incrementally:

**Phase 1 — Foundation:** Repository setup, architecture, database, authentication, tenancy and project management.

**Phase 2 — Core Chainage:** Alignments, chainage validation, issue register, issue creation and lifecycle management.

**Phase 3 — Mapping:** Interactive GIS map, alignment overlays, markers, GPS capture and spatial queries.

**Phase 4 — Audit and Quality:** Inspections, NCRs, corrective actions, approvals, evidence and immutable-style audit event recording.

**Phase 5 — Field Operations:** Mobile optimisation, offline drafting, synchronisation and notifications.

**Phase 6 — Production Readiness:** Security review, automated tests, performance testing, backup/restore verification, accessibility checks and deployment.

## 8. Acceptance Criteria

The application must demonstrate that:

- Two separate organisations cannot access each other's records.
- A user can create a project and import a valid alignment.
- A field engineer can create an issue at CH 3+450 with photos and GPS coordinates.
- The issue appears in the register, chainage timeline and geographic map where location data exists.
- A project manager can assign the issue and track corrective actions.
- An inspector can review the resolution and approve closure.
- Every significant change is recorded in the audit history.
- A project manager can export an issue register and audit report.
- The application works on desktop and mobile.
- Automated tests cover permissions, chainage calculations and critical workflows.
- The application can be deployed using documented Vercel and Supabase configuration.

## 9. Instructions for Codex

First inspect the existing repository and reuse working functionality where appropriate.

Before implementation, produce a concise architecture plan, database design, milestone breakdown and identified risks.

Then implement the application incrementally, writing actual working code rather than pseudocode.

Run available tests, type checks, linting and build verification after each major milestone. Fix failures before continuing.

Never hardcode secrets, bypass authorisation, or silently substitute mocked data for production persistence.

Clearly distinguish implemented functionality, tested functionality and features still requiring external services or manual configuration.

Prioritise correctness, security, usability and maintainability over unnecessary complexity.

**Final goal:** Deliver a commercially viable chainage management and infrastructure audit platform that can be piloted with an Australian civil construction contractor and developed into a scalable SaaS business.
