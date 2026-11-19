"use client";
import { useEffect, useState } from "react";
import { statuses, type Issue, type WorkspaceData } from "@/lib/types";
import { uploadEvidence } from "@/lib/evidence";
import { formatChainage } from "@/lib/chainage";
export default function IssueDetail({
  issue,
  data,
  demo,
  onSaved,
}: {
  issue: Issue;
  data: WorkspaceData;
  demo: boolean;
  onSaved: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [evidence, setEvidence] = useState<
      { id: string; filename: string; scan_status: string }[]
    >([]),
    [comments, setComments] = useState<
      { id: string; body: string; created_by: string; created_at: string }[]
    >([]);
  async function refresh() {
    const responses = await Promise.all(
      ["evidence", "comments"].map((r) =>
        fetch(`/api/${r}?issue=${issue.id}`).then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error);
          return body;
        }),
      ),
    );
    setEvidence(responses[0]);
    setComments(responses[1]);
  }
  useEffect(() => {
    if (demo) return;
    let active = true;
    Promise.all(
      ["evidence", "comments"].map((resource) =>
        fetch(`/api/${resource}?issue=${issue.id}`).then(async (r) => {
          const body = await r.json();
          if (!r.ok) throw new Error(body.error);
          return body;
        }),
      ),
    )
      .then(([attachments, thread]) => {
        if (active) {
          setEvidence(attachments);
          setComments(thread);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [issue.id, demo]);
  async function update(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    try {
      const response = await fetch("/api/issues", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: issue.id,
          version: issue.version,
          status: form.get("status"),
          assignee_id: form.get("assignee_id") || null,
          resolution: form.get("resolution"),
          reason: form.get("reason"),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  async function comment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: issue.project_id,
          issue_id: issue.id,
          body: new FormData(form).get("body"),
        }),
      });
      if (!response.ok) throw new Error((await response.json()).error);
      form.reset();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comment failed");
    }
  }
  async function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      await uploadEvidence(issue.id, file);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }
  async function download(id: string) {
    try {
      const r = await fetch(`/api/evidence?id=${id}`);
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      window.open(body.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }
  return (
    <div className="detail-content">
      <div className="detail-meta">
        <span className={`badge ${issue.severity.toLowerCase()}`}>
          {issue.severity}
        </span>
        <span>{issue.category}</span>
        <span className="mono">{issue.reference}</span>
      </div>
      <h3>{issue.title}</h3>
      <p>{issue.description || "No description provided."}</p>
      <div className="detail-location">
        <strong>
          {formatChainage(issue.start_m)}
          {issue.end_m !== null ? ` — ${formatChainage(issue.end_m)}` : ""}
        </strong>
        <span>
          Offset {issue.offset_m} m ·{" "}
          {issue.location_source === "gps"
            ? `GPS estimate ±${issue.accuracy_m ?? "unknown"} m`
            : issue.location_source === "surveyed"
              ? "Surveyed location"
              : "Manual chainage"}
        </span>
        {issue.latitude !== null && (
          <span>
            {issue.latitude.toFixed(6)}, {issue.longitude?.toFixed(6)}
          </span>
        )}
      </div>
      {demo && (
        <p className="notice">
          Read-only demonstration. Connect Supabase to update records and upload
          evidence.
        </p>
      )}
      <form onSubmit={update} className="edit-form">
        <fieldset disabled={demo || busy}>
          <div className="form-grid">
            <label>
              Status
              <select name="status" defaultValue={issue.status}>
                {statuses.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label>
              Assigned owner
              <select name="assignee_id" defaultValue={issue.assignee_id ?? ""}>
                <option value="">Unassigned</option>
                {data.members
                  .filter((m) => m.project_id === issue.project_id)
                  .map((m) => (
                    <option key={m.user_id} value={m.user_id}>
                      {m.user_id.slice(0, 8)} · {m.role}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <label>
            Resolution / corrective work
            <textarea
              name="resolution"
              defaultValue={issue.resolution}
              rows={3}
            />
          </label>
          <label>
            Reason / review note
            <textarea
              name="reason"
              placeholder="Required when reopening a closed issue"
              rows={2}
            />
          </label>
          <p className="hint">
            Closure requires reviewer permission, a resolution, clean evidence
            and completed corrective actions.
          </p>
          <button className="primary">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </fieldset>
      </form>
      <section className="detail-section">
        <h4>Evidence</h4>
        {evidence.length === 0 && (
          <p className="muted">No evidence uploaded.</p>
        )}
        {evidence.map((e) => (
          <div className="evidence-row" key={e.id}>
            <span>
              {e.filename}
              <small>{e.scan_status}</small>
            </span>
            <button
              disabled={e.scan_status !== "clean"}
              onClick={() => download(e.id)}
            >
              Open
            </button>
          </div>
        ))}
        <label>
          Attach evidence
          <input
            aria-label="Attach evidence"
            disabled={demo || busy}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            onChange={upload}
          />
        </label>
        <p className="hint">
          Files remain quarantined until a trusted scan clears them.
        </p>
      </section>
      <section className="detail-section">
        <h4>Comments & field notes</h4>
        {comments.map((c) => (
          <div className="comment" key={c.id}>
            <small>
              {c.created_by.slice(0, 8)} ·{" "}
              {new Date(c.created_at).toLocaleString("en-AU")}
            </small>
            <p>{c.body}</p>
          </div>
        ))}
        <form onSubmit={comment}>
          <label>
            Add a comment
            <textarea name="body" required maxLength={5000} disabled={demo} />
          </label>
          <button disabled={demo}>Post comment</button>
        </form>
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
