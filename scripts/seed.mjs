import pg from "pg";
if (
  !process.env.SEED_DATABASE_URL ||
  !process.env.SEED_OWNER_ID ||
  process.env.SEED_CONFIRM !== "create-demo-organisation"
) {
  console.error(
    "Set SEED_DATABASE_URL, SEED_OWNER_ID (existing Auth user UUID), and SEED_CONFIRM=create-demo-organisation. Use a development Supabase project.",
  );
  process.exit(1);
}
const db = new pg.Client({ connectionString: process.env.SEED_DATABASE_URL });
await db.connect();
try {
  await db.query("begin");
  const owner = process.env.SEED_OWNER_ID;
  const user = await db.query("select id from auth.users where id=$1", [owner]);
  if (!user.rowCount)
    throw new Error("Create and verify this user in Supabase Auth first.");
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner]);
  await db.query("set local role authenticated");
  const org = (
    await db.query(
      "select bootstrap_organisation('Western Civil — seeded demo') as id",
    )
  ).rows[0].id;
  const project = (
    await db.query(
      "insert into projects(organisation_id,name,description,location,start_m,end_m)values($1,'Western Sydney Road Upgrade','Demonstration records — not live construction data','Western Sydney, NSW',0,10000) returning id",
      [org],
    )
  ).rows[0].id;
  const alignment = (
    await db.query(
      "insert into alignments(project_id,name,start_m,end_m,geometry)values($1,'MC01 — uncalibrated demonstration alignment',0,10000,$2) returning id",
      [
        project,
        JSON.stringify({
          type: "LineString",
          coordinates: [
            [150.72, -33.77],
            [150.754, -33.747],
            [150.8, -33.722],
            [150.82, -33.71],
          ],
        }),
      ],
    )
  ).rows[0].id;
  for (const [title, category, severity, start] of [
    ["Pavement cracking at tie-in", "Defect", "High", 3450],
    [
      "Culvert headwall reinforcement cover",
      "Non-conformance",
      "Critical",
      4820,
    ],
    ["Sediment fence requires repair", "Environmental", "Medium", 2100],
    ["Drainage pit lid out of tolerance", "Defect", "High", 5680],
  ]) {
    await db.query(
      "insert into issues(project_id,alignment_id,title,category,severity,start_m,longitude,latitude,location_source)values($1,$2,$3,$4,$5,$6,$7,$8,'manual')",
      [
        project,
        alignment,
        title,
        category,
        severity,
        start,
        150.72 + start / 100000,
        -33.77 + start / 166667,
      ],
    );
  }
  await db.query(
    "insert into inspection_templates(project_id,title,questions)values($1,'Pavement hold point',$2)",
    [
      project,
      JSON.stringify([
        "Compaction complies with specification",
        "Surface finish accepted",
        "Survey levels verified",
      ]),
    ],
  );
  await db.query("commit");
  console.log(
    `Created demonstration organisation ${org} and project ${project}. Sign in as the configured owner.`,
  );
} catch (e) {
  await db.query("rollback");
  throw e;
} finally {
  await db.end();
}
