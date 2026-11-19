import { NextResponse } from "next/server";
import { z } from "zod";
import { context, dbError, failure, HttpError } from "@/lib/http";
export async function POST(request: Request) {
  try {
    const { db } = await context(request, true);
    const body = z
      .object({
        issue_id: z.string().uuid(),
        filename: z.string().min(1).max(200),
        mime_type: z.enum([
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ]),
        size_bytes: z.number().int().min(1).max(10485760),
      })
      .parse(await request.json());
    const { data: issue, error: issueError } = await db
      .from("issues")
      .select("id,project_id")
      .eq("id", body.issue_id)
      .single();
    dbError(issueError);
    if (!issue) throw new HttpError(404, "Issue not found");
    const id = crypto.randomUUID();
    const path = `${issue.project_id}/${issue.id}/${id}`;
    const { error } = await db.from("evidence").insert({
      id,
      project_id: issue.project_id,
      ...body,
      storage_path: path,
    });
    dbError(error);
    const { data: signed, error: signError } = await db.storage
      .from("evidence")
      .createSignedUploadUrl(path);
    dbError(signError);
    return NextResponse.json(
      { id, path, token: signed!.token },
      { status: 201, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    if (e instanceof z.ZodError)
      return failure(
        new HttpError(400, "Choose a JPEG, PNG, WebP or PDF up to 10 MB."),
      );
    return failure(e);
  }
}
export async function GET(request: Request) {
  try {
    const { db } = await context(request);
    const issueId = new URL(request.url).searchParams.get("issue");
    if (issueId) {
      const validId = z.string().uuid().parse(issueId);
      const { data, error } = await db
        .from("evidence")
        .select("id,filename,scan_status,created_at")
        .eq("issue_id", validId)
        .order("created_at", { ascending: false })
        .limit(1000);
      dbError(error);
      return NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store" },
      });
    }
    const id = z
      .string()
      .uuid()
      .parse(new URL(request.url).searchParams.get("id"));
    const { data, error } = await db
      .from("evidence")
      .select("*")
      .eq("id", id)
      .eq("scan_status", "clean")
      .single();
    dbError(error);
    const { data: signed, error: signError } = await db.storage
      .from("evidence")
      .createSignedUrl(data.storage_path, 60);
    dbError(signError);
    return NextResponse.json(
      { url: signed!.signedUrl },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
