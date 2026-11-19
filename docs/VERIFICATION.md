# Local verification

Verified 19 November 2026, before delivery:

| Check                                                                | Result                     |
| -------------------------------------------------------------------- | -------------------------- |
| TypeScript strict checks                                             | Passed                     |
| ESLint application checks                                            | Passed                     |
| Unit/component/API regression tests                                  | 30 passed                  |
| PostgreSQL 16 / PostGIS 3.4 migration and security integration tests | 23 passed                  |
| Desktop/mobile Playwright checks                                     | 14 passed                  |
| Next.js production build                                             | Passed                     |
| npm dependency audit                                                 | 0 reported vulnerabilities |

The real database suite verified tenant isolation for projects/issues/audit/evidence, cross-project foreign keys, chainage bounds, forged creator/status rejection, viewer restrictions, direct-update restrictions, optimistic conflicts, review-gated closure, quarantine, clean-file isolation, reopening reasons and inspection approvals.

Visual inspection identified and corrected MapLibre 6's separately loaded worker URL and CSS container sizing. Browser coverage includes a regression check for loaded map endpoints.

No live Supabase account, production Vercel deployment, SMTP delivery, malware scanner or licensed tile provider was provisioned or tested. The integration database uses minimal Auth/Storage schema fixtures to exercise the actual PostgreSQL policies. Real Auth/Storage staging verification and backup restore drills remain required.

## Satellite basemap correction

Verified real NSW Spatial Services image tiles and street tiles in the application browser. Satellite now opens by default without environment variables for NSW projects. View switching retains camera and overlays; filtering no longer recreates the map. Regression tests cover attributed defaults, regional coverage, street/satellite switching and tile-failure recovery. Network fixtures make browser regression tests deterministic; the live-provider visual check is separate.
