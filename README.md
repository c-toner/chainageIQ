# ChainageIQ

A Vercel-ready Next.js application for infrastructure issues, chainage, inspections and quality records, backed by Supabase PostgreSQL/PostGIS, Auth and private Storage.

**This is an implemented pilot foundation, not a certified production release.** Real persistence, permission enforcement and workflow logic are included. Supabase, map tiles and evidence scanning must be configured before live use. See [implementation status](docs/IMPLEMENTATION-STATUS.md) for precise scope and verification limits.

## Run locally

Use Node.js 22 or 24 LTS.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open [localhost:3000](http://localhost:3000). With no Supabase settings, the application displays a setup page. [localhost:3000/demo](http://localhost:3000/demo) is a clearly labelled read-only demonstration; it never writes fake data into the live workspace.

## Connect Supabase

1. Create a Supabase project in an appropriate Australian region. Enable the PostGIS extension in the `public` schema (the migration also attempts this).
2. Apply both SQL files in `supabase/migrations` in filename order using the Supabase SQL editor or your migration pipeline. They create RLS policies, transactional workflow functions, auditing and a private `evidence` bucket.
3. Copy the project's URL and anon/publishable API key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. These are public identifiers; RLS protects data. Never put a service-role key in a `NEXT_PUBLIC_` variable or the Vercel app.
4. Configure Supabase Auth's Site URL and allowed redirect URL `http://localhost:3000/auth/callback`. Add the production callback when deploying. Configure production SMTP and appropriate Auth rate limits. Do not disable email verification for invitations.
5. Restart Next.js and use `/login` to request an email sign-in link. In Administration, create your organisation. In Projects, create your first project. Import an alignment from Chainage Timeline. The creator receives an explicit project admin membership.
6. Create invitations in Administration and share the returned token through an approved channel. Invitees sign in with the invited email and accept the token in Administration. The application does not send invitation emails itself.

Satellite imagery and street maps now work without map credentials for NSW projects. The defaults use attributed NSW Spatial Services imagery (aerial/satellite) and street tiles. The imagery is not live; capture dates and available resolution vary. A coverage notice appears outside NSW.

For projects outside NSW or a contracted commercial service, configure `NEXT_PUBLIC_MAP_STYLE_URL` and `NEXT_PUBLIC_SATELLITE_STYLE_URL` with MapLibre-compatible style URLs. Explicit URLs override the regional defaults. Restrict provider keys to your application origins and redeploy after changing these build-time variables. The application includes loading, timeout, visible partial-tile failure, retry, fit-project, scale and fullscreen controls. Switching styles preserves the camera; filtering updates overlays without recreating the map.

Sources: [NSW imagery catalogue](https://www.data.nsw.gov.au/data/dataset/nsw-imagery), [NSW street basemap catalogue](https://data.nsw.gov.au/data/dataset/nsw-basemap). Public service availability is outside the app's control; arrange a provider SLA if required by the client.

## Deploy to Vercel

1. Create a Git repository from this folder and push it to your Git hosting account.
2. Import it into Vercel as a Next.js project. Select Node.js 22 or 24. `vercel.json` sets the build command and Sydney function region.
3. Configure the environment variables from `.env.example` for the required environments. Use a separate Supabase project for previews; do not connect untrusted previews to production data.
4. Apply migrations to Supabase before enabling user traffic. Deploy and add the final HTTPS callback URL to Supabase Auth.
5. Verify sign-in, organisation/project creation, alignment import, an issue at `CH 3+450`, evidence upload and scan, reviewer closure, exports and tenant isolation in staging.

Files upload directly to private Supabase Storage using a scoped signed upload token; large evidence files do not traverse Vercel functions. Downloads use 60-second signed URLs only after a clean scan verdict. Hosting the source alone does not provision Supabase or a scanner.

## Seed persistent demonstration data

The built-in `/demo` requires no services. For an editable, database-backed demonstration, create an Auth user in a development Supabase project and run:

```sh
# Supply these through your shell or secret manager; do not commit credentials.
export SEED_DATABASE_URL='your-development-database-connection-string'
export SEED_OWNER_ID='existing-verified-auth-user-uuid'
export SEED_CONFIRM='create-demo-organisation'
node scripts/seed.mjs
```

This intentionally creates a new labelled organisation and project on each run. It does not create Auth accounts or pretend sample geometry is calibrated.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=high
```

Database tests require an **empty, disposable** PostGIS database; never point the test runner at production. They create minimal Auth/Storage SQL fixtures to exercise the actual migrations and RLS policies, not a replacement implementation.

```sh
docker run --name chainageiq-test-db -e POSTGRES_PASSWORD=local-test-only \
  -p 127.0.0.1:55439:5432 -d postgis/postgis:16-3.4
TEST_DATABASE_URL=postgresql://postgres:local-test-only@localhost:55439/postgres npm run test:db
```

The suite refuses an existing application database. Use a fresh database for each run. GitHub Actions runs type checks, lint, unit tests, build, browser checks, dependency audit and a separate PostGIS integration job.

## Documentation

- [Architecture and schema](docs/ARCHITECTURE.md)
- [User guide](docs/USER-GUIDE.md)
- [Security and administrator operations](docs/OPERATIONS.md)
- [Implemented scope and remaining work](docs/IMPLEMENTATION-STATUS.md)

Auth integration follows [Supabase's server-side authentication guidance](https://supabase.com/docs/guides/auth/server-side/creating-a-client); session refresh uses the [Next.js Proxy convention](https://nextjs.org/docs/app/getting-started/proxy).
