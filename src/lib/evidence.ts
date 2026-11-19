import { createBrowserClient } from "@supabase/ssr";
export async function uploadEvidence(issueId: string, file: File) {
  if (file.size > 10485760 || !file.size)
    throw new Error("Choose a file between 1 byte and 10 MB.");
  const r = await fetch("/api/evidence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      issue_id: issueId,
      filename: file.name,
      mime_type: file.type,
      size_bytes: file.size,
    }),
  });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error);
  const db = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { error } = await db.storage
    .from("evidence")
    .uploadToSignedUrl(body.path, body.token, file, { contentType: file.type });
  if (error) throw error;
  return body.id as string;
}
