import { NextResponse } from "next/server";
import { z } from "zod";
import { context, dbError, failure, HttpError } from "@/lib/http";
import {
  projectSchema,
  alignmentSchema,
  issueSchema,
  updateIssueSchema,
  inspectionSchema,
  actionSchema,
  commentSchema,
} from "@/lib/validation";
const tables: Record<string, string> = {
  projects: "projects",
  alignments: "alignments",
  issues: "issues",
  inspections: "inspections",
  actions: "corrective_actions",
  audit: "audit_events",
  comments: "comments",
  evidence: "evidence",
  templates: "inspection_templates",
  members: "project_memberships",
};
export async function GET(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const { db } = await context(request);
    const table = tables[resource];
    if (!table) throw new HttpError(404, "Not found");
    const url = new URL(request.url);
    let query = db.from(table).select("*").limit(1000);
    const project = url.searchParams.get("project");
    if (project && resource !== "projects")
      query = query.eq("project_id", z.string().uuid().parse(project));
    const issue = url.searchParams.get("issue");
    if (issue && ["comments", "evidence"].includes(resource))
      query = query.eq("issue_id", z.string().uuid().parse(issue));
    if (resource === "audit")
      query = query.order("created_at", { ascending: false });
    const { data, error } = await query;
    dbError(error);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const { db } = await context(request, true);
    const raw = await request.text();
    if (raw.length > 2000000) throw new HttpError(413, "Request too large");
    const body = JSON.parse(raw);
    if (resource === "organisations") {
      const parsed = z
        .object({ name: z.string().trim().min(2).max(160) })
        .parse(body);
      const { data, error } = await db.rpc("bootstrap_organisation", {
        p_name: parsed.name,
      });
      dbError(error);
      return NextResponse.json({ id: data });
    }
    if (resource === "invitations") {
      const p = z
        .object({
          organisation_id: z.string().uuid(),
          project_id: z.string().uuid().nullable(),
          email: z.email(),
          role: z.enum(["admin", "manager", "engineer", "inspector", "viewer"]),
        })
        .parse(body);
      const { data, error } = await db.rpc("create_invitation", {
        p_org: p.organisation_id,
        p_project: p.project_id,
        p_email: p.email,
        p_role: p.role,
      });
      dbError(error);
      return NextResponse.json({ token: data });
    }
    if (resource === "accept-invitation") {
      const p = z
        .object({ token: z.string().regex(/^[a-f0-9]{64}$/) })
        .parse(body);
      const { error } = await db.rpc("accept_invitation", { p_token: p.token });
      dbError(error);
      return NextResponse.json({ ok: true });
    }
    const schemas = {
      projects: projectSchema,
      alignments: alignmentSchema,
      issues: issueSchema,
      inspections: inspectionSchema,
      actions: actionSchema,
      comments: commentSchema,
    };
    const schema = schemas[resource as keyof typeof schemas];
    if (!schema) throw new HttpError(404, "Not found");
    const parsed = schema.safeParse(body);
    if (!parsed.success)
      throw new HttpError(
        400,
        parsed.error.issues.map((i) => i.message).join("; "),
      );
    const { data, error } = await db
      .from(tables[resource])
      .insert(parsed.data as Record<string, unknown>)
      .select()
      .single();
    if (
      resource === "issues" &&
      error?.code === "23505" &&
      "id" in parsed.data &&
      parsed.data.id
    ) {
      const { data: existing } = await db
        .from("issues")
        .select("*")
        .eq("id", parsed.data.id)
        .single();
      if (existing) return NextResponse.json(existing);
    }
    dbError(error);
    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json(
        { error: e.issues.map((i) => i.message).join("; ") },
        { status: 400 },
      );
    return failure(e);
  }
}
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resource: string }> },
) {
  try {
    const { resource } = await params;
    const { db } = await context(request, true);
    const body = await request.json();
    if (resource === "issues") {
      const p = updateIssueSchema.parse(body);
      const { data, error } = await db.rpc("update_issue", {
        p_id: p.id,
        p_version: p.version,
        p_status: p.status,
        p_assignee: p.assignee_id,
        p_resolution: p.resolution,
        p_reason: p.reason,
      });
      dbError(error);
      return NextResponse.json(data);
    }
    if (resource === "inspections" || resource === "actions") {
      const p = z
        .object({ id: z.string().uuid(), status: z.string().max(30) })
        .parse(body);
      const { error } = await db.rpc(
        resource === "inspections" ? "review_inspection" : "update_action",
        { p_id: p.id, p_status: p.status },
      );
      dbError(error);
      return NextResponse.json({ ok: true });
    }
    throw new HttpError(404, "Not found");
  } catch (e) {
    if (e instanceof z.ZodError)
      return NextResponse.json({ error: "Invalid update" }, { status: 400 });
    return failure(e);
  }
}
