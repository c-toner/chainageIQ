// Run only against an expendable database: this suite creates Supabase-compatible auth/storage fixtures.
import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error(
    "Set TEST_DATABASE_URL to an EMPTY, DISPOSABLE PostgreSQL/PostGIS database.",
  );
  process.exit(1);
}
const db = new pg.Client({ connectionString: url });
await db.connect();
let checks = 0;
async function test(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
async function rejected(sql, values = []) {
  await assert.rejects(db.query(sql, values));
}
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  E = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  I = "11111111-1111-4111-8111-111111111111",
  V = "22222222-2222-4222-8222-222222222222";
async function asUser(id) {
  await db.query("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.query("set role authenticated");
}
try {
  const exists = await db.query(
    "select to_regclass('public.organisations') as existing",
  );
  if (exists.rows[0].existing)
    throw new Error(
      "Refusing to run against a non-empty application database.",
    );
  await db.query(
    `do $$begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;end $$;create schema auth;create schema storage;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated;grant execute on function auth.uid() to authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;`,
  );
  for (const f of (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  )
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.query(
      await readFile(
        new URL(`../supabase/migrations/${f}`, import.meta.url),
        "utf8",
      ),
    );
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now()),($5,$6,now()),($7,$8,now()),($9,$10,now())",
    [
      A,
      "admin-a@example.test",
      B,
      "admin-b@example.test",
      E,
      "engineer@example.test",
      I,
      "inspector@example.test",
      V,
      "viewer@example.test",
    ],
  );
  await asUser(A);
  const orgA = (
    await db.query("select bootstrap_organisation('Contractor A') as id")
  ).rows[0].id;
  const projectA = (
    await db.query(
      "insert into projects(organisation_id,name,start_m,end_m) values($1,'Project A',0,10000) returning id",
      [orgA],
    )
  ).rows[0].id;
  await asUser(B);
  const orgB = (
    await db.query("select bootstrap_organisation('Contractor B') as id")
  ).rows[0].id;
  const projectB = (
    await db.query(
      "insert into projects(organisation_id,name,start_m,end_m) values($1,'Project B',0,10000) returning id",
      [orgB],
    )
  ).rows[0].id;
  await test("organisation B cannot read project A", async () =>
    assert.equal(
      (await db.query("select * from projects where id=$1", [projectA]))
        .rowCount,
      0,
    ));
  await test("organisation B cannot import into project A", () =>
    rejected(
      "insert into alignments(project_id,name,start_m,end_m,geometry)values($1,'Foreign alignment',0,1000,$2)",
      [
        projectA,
        JSON.stringify({
          type: "LineString",
          coordinates: [
            [150, -33],
            [150.1, -33],
          ],
        }),
      ],
    ));
  await asUser(A);
  const alignment = (
    await db.query(
      "insert into alignments(project_id,name,start_m,end_m,geometry)values($1,'MC01',0,10000,$2) returning id",
      [
        projectA,
        JSON.stringify({
          type: "LineString",
          coordinates: [
            [150, -33],
            [150.1, -33],
          ],
        }),
      ],
    )
  ).rows[0].id;
  await test("invalid chainage is rejected by database", () =>
    rejected(
      "insert into issues(project_id,alignment_id,title,category,severity,start_m)values($1,$2,'Outside bounds','Defect','High',10001)",
      [projectA, alignment],
    ));
  await test("cross-project alignment is rejected", () =>
    rejected(
      "insert into issues(project_id,alignment_id,title,category,severity,start_m)values($1,$2,'Wrong project','Defect','High',3450)",
      [projectB, alignment],
    ));
  for (const [user, email, role] of [
    [E, "engineer@example.test", "engineer"],
    [I, "inspector@example.test", "inspector"],
    [V, "viewer@example.test", "viewer"],
  ]) {
    await asUser(A);
    const token = (
      await db.query("select create_invitation($1,$2,$3,$4) as token", [
        orgA,
        projectA,
        email,
        role,
      ])
    ).rows[0].token;
    await asUser(user);
    await db.query("select accept_invitation($1)", [token]);
  }
  await asUser(E);
  const issue = (
    await db.query(
      "insert into issues(project_id,alignment_id,title,category,severity,start_m,status,created_by)values($1,$2,'Pavement cracking','Defect','High',3450,'Closed',$3) returning *",
      [projectA, alignment, A],
    )
  ).rows[0];
  await test("client cannot forge creator or bypass workflow on insert", async () => {
    assert.equal(issue.created_by, E);
    assert.equal(issue.status, "Open");
  });
  await test("direct issue updates are blocked", () =>
    rejected("update issues set status='Closed' where id=$1", [issue.id]));
  await db.query("select update_issue($1,1,'In Progress',null,'','')", [
    issue.id,
  ]);
  await test("optimistic version conflict rejected", () =>
    rejected("select update_issue($1,1,'Ready for Review',null,'','')", [
      issue.id,
    ]));
  await db.query(
    "select update_issue($1,2,'Ready for Review',null,'Repaired pavement','')",
    [issue.id],
  );
  await test("engineer cannot approve closure", () =>
    rejected("select update_issue($1,3,'Closed',null,'Repaired pavement','')", [
      issue.id,
    ]));
  await asUser(V);
  await test("viewer cannot create issue", () =>
    rejected(
      "insert into issues(project_id,alignment_id,title,category,severity,start_m)values($1,$2,'Viewer write','Defect','High',3450)",
      [projectA, alignment],
    ));
  await test("viewer cannot mutate workflow", () =>
    rejected("select update_issue($1,3,'Closed',null,'Repaired pavement','')", [
      issue.id,
    ]));
  await asUser(B);
  await test("tenant B cannot read issues or audit history", async () => {
    assert.equal((await db.query("select * from issues")).rowCount, 0);
    assert.equal(
      (
        await db.query("select * from audit_events where project_id=$1", [
          projectA,
        ])
      ).rowCount,
      0,
    );
  });
  await test("tenant B cannot mutate issue by UUID", () =>
    rejected("select update_issue($1,3,'Closed',null,'Repaired pavement','')", [
      issue.id,
    ]));
  await asUser(I);
  await test("closure requires clean evidence", () =>
    rejected("select update_issue($1,3,'Closed',null,'Repaired pavement','')", [
      issue.id,
    ]));
  const evidenceId = "33333333-3333-4333-8333-333333333333";
  const path = `${projectA}/${issue.id}/${evidenceId}`;
  await db.query(
    "insert into evidence(id,project_id,issue_id,filename,storage_path,mime_type,size_bytes)values($1,$2,$3,'repair.jpg',$4,'image/jpeg',100)",
    [evidenceId, projectA, issue.id, path],
  );
  await db.query(
    "insert into storage.objects(bucket_id,name)values('evidence',$1)",
    [path],
  );
  await test("quarantined files cannot be retrieved", async () =>
    assert.equal(
      (await db.query("select * from storage.objects")).rowCount,
      0,
    ));
  await test("normal users cannot clear quarantine", () =>
    rejected("update evidence set scan_status='clean' where id=$1", [
      evidenceId,
    ]));
  await db.query("reset role");
  await db.query("update evidence set scan_status='clean' where id=$1", [
    evidenceId,
  ]);
  await asUser(I);
  await test("clean evidence readable by authorised project member", async () =>
    assert.equal(
      (await db.query("select * from storage.objects")).rowCount,
      1,
    ));
  await db.query(
    "select update_issue($1,3,'Closed',null,'Repaired pavement','')",
    [issue.id],
  );
  await test("reviewer closure persists with approval", async () => {
    assert.equal(
      (await db.query("select status from issues where id=$1", [issue.id]))
        .rows[0].status,
      "Closed",
    );
    assert.equal(
      (await db.query("select * from approvals where entity_id=$1", [issue.id]))
        .rowCount,
      1,
    );
  });
  await test("reopening requires a reason", () =>
    rejected("select update_issue($1,4,'Open',null,'Repaired pavement','')", [
      issue.id,
    ]));
  await db.query(
    "select update_issue($1,4,'Open',null,'Repaired pavement','Defect recurred after rainfall')",
    [issue.id],
  );
  await test("audit records preserve old and new values and actor", async () => {
    const r = await db.query(
      "select * from audit_events where entity_id=$1 and action='UPDATE' order by created_at desc",
      [issue.id],
    );
    assert.equal(r.rows[0].actor_id, I);
    assert.equal(r.rows[0].before_data.status, "Closed");
    assert.equal(r.rows[0].after_data.status, "Open");
  });
  await test("audit history cannot be changed or deleted", async () => {
    await rejected("update audit_events set action='FORGED'");
    await rejected("delete from audit_events");
    await rejected(
      "insert into audit_events(organisation_id,action,entity_type,entity_id)values($1,'FAKE','issues',$2)",
      [orgA, issue.id],
    );
  });
  await asUser(B);
  await test("clean files remain isolated between tenants", async () =>
    assert.equal(
      (await db.query("select * from storage.objects")).rowCount,
      0,
    ));
  await asUser(E);
  const inspection = (
    await db.query(
      "insert into inspections(project_id,title,responses)values($1,'Hold point',$2) returning id",
      [
        projectA,
        JSON.stringify([
          { question: "Compaction compliant?", result: "pass", note: "" },
        ]),
      ],
    )
  ).rows[0].id;
  await test("engineer cannot sign off inspections", () =>
    rejected("select review_inspection($1,'Approved')", [inspection]));
  await asUser(I);
  await db.query("select review_inspection($1,'Approved')", [inspection]);
  await test("inspection approval persists", async () =>
    assert.equal(
      (
        await db.query("select status from inspections where id=$1", [
          inspection,
        ])
      ).rows[0].status,
      "Approved",
    ));
  console.log(`\n${checks} database integration checks passed.`);
} finally {
  await db.end();
}
