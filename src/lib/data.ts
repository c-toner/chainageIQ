import { supabase } from "./supabase/server";
import type { WorkspaceData } from "./types";
export async function loadWorkspace(): Promise<WorkspaceData | null> {
  const db = await supabase();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const tables = [
    "projects",
    "alignments",
    "issues",
    "inspections",
    "corrective_actions",
    "audit_events",
    "project_memberships",
  ] as const;
  const results = await Promise.all(
    tables.map((t) =>
      t === "audit_events"
        ? db
            .from(t)
            .select("*")
            .order("created_at", { ascending: false })
            .limit(1000)
        : db.from(t).select("*").limit(1000),
    ),
  );
  for (const r of results)
    if (r.error) throw new Error(`Database query failed: ${r.error.message}`);
  const { data: org, error } = await db
    .from("organisations")
    .select("id,name")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return {
    projects: results[0].data ?? [],
    alignments: results[1].data ?? [],
    issues: results[2].data ?? [],
    inspections: results[3].data ?? [],
    actions: results[4].data ?? [],
    audit: results[5].data ?? [],
    members: results[6].data ?? [],
    userId: user.id,
    organisationId: org?.id ?? "",
    organisationName: org?.name ?? "Your workspace",
  };
}
