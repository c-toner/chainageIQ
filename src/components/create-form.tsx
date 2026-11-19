"use client";
import { useState } from "react";
import type { WorkspaceData } from "@/lib/types";
import { parseChainage, locateOnAlignment } from "@/lib/chainage";
import { issueSchema } from "@/lib/validation";
import { uploadEvidence } from "@/lib/evidence";
import { saveDraft } from "@/lib/offline";
import { LocateFixed } from "lucide-react";
export type FormKind =
  | "issue"
  | "project"
  | "alignment"
  | "inspection"
  | "action"
  | "organisation"
  | "invitation"
  | "accept-invitation";
export default function CreateForm({
  kind,
  data,
  projectId,
  onDone,
  location,
}: {
  kind: FormKind;
  data: WorkspaceData;
  projectId: string;
  onDone: (message: string) => void;
  location?: { lon: number; lat: number };
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [gps, setGps] = useState<{
      lon: number;
      lat: number;
      accuracy: number | null;
    } | null>(location ? { ...location, accuracy: null } : null),
    [chainage, setChainage] = useState(""),
    [alignmentId, setAlignmentId] = useState(
      data.alignments.find((a) => a.project_id === projectId)?.id ?? "",
    ),
    [gpsMessage, setGpsMessage] = useState("");
  async function capture() {
    setGpsMessage("Locating…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const point = {
          lon: p.coords.longitude,
          lat: p.coords.latitude,
          accuracy: p.coords.accuracy,
        };
        setGps(point);
        const alignment = data.alignments.find((a) => a.id === alignmentId);
        try {
          if (!alignment) throw new Error("Select an alignment.");
          const found = locateOnAlignment(
            point.lon,
            point.lat,
            alignment.geometry.coordinates,
            alignment.calibration,
          );
          setChainage(found.chainage.toFixed(2));
          setGpsMessage(
            `Estimated chainage. GPS ±${Math.round(point.accuracy)} m. Verify on site.`,
          );
        } catch (e) {
          setGpsMessage(
            `${e instanceof Error ? e.message : ""} GPS saved separately.`,
          );
        }
      },
      () =>
        setGpsMessage(
          "Location unavailable. Check device permissions or enter location manually.",
        ),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const str = (key: string) => String(form.get(key) ?? "");
    try {
      let payload: Record<string, unknown> = {};
      let resource = "";
      if (kind === "organisation") {
        resource = "organisations";
        payload = { name: str("name") };
      }
      if (kind === "project") {
        resource = "projects";
        payload = {
          organisation_id: data.organisationId,
          name: str("name"),
          description: str("description"),
          location: str("location"),
          start_m: parseChainage(str("start")),
          end_m: parseChainage(str("end")),
        };
      }
      if (kind === "alignment") {
        resource = "alignments";
        const file = form.get("geojson");
        if (!(file instanceof File) || file.size > 2000000)
          throw new Error("Choose a GeoJSON file up to 2 MB.");
        const geo = JSON.parse(await file.text());
        const geometry = geo.type === "Feature" ? geo.geometry : geo;
        payload = {
          project_id: projectId,
          name: str("name"),
          start_m: parseChainage(str("start")),
          end_m: parseChainage(str("end")),
          geometry,
          calibration: str("calibration").trim()
            ? JSON.parse(str("calibration"))
            : [],
        };
      }
      if (kind === "issue") {
        resource = "issues";
        payload = {
          id: crypto.randomUUID(),
          project_id: projectId,
          alignment_id: alignmentId,
          title: str("title"),
          description: str("description"),
          category: str("category"),
          severity: str("severity"),
          start_m: parseChainage(chainage),
          end_m: str("end") ? parseChainage(str("end")) : null,
          offset_m: Number(str("offset") || 0),
          due_date: str("due_date") || null,
          longitude: gps?.lon ?? null,
          latitude: gps?.lat ?? null,
          accuracy_m: gps?.accuracy ?? null,
          location_source: gps
            ? gps.accuracy === null
              ? "manual"
              : "gps"
            : "manual",
          assignee_id: null,
        };
        const validated = issueSchema.parse(payload);
        if (!navigator.onLine) {
          const attachment = form.get("file");
          if (attachment instanceof File && attachment.size)
            throw new Error(
              "Offline drafts cannot include files yet. Remove the attachment and save the draft, then upload evidence after syncing.",
            );
          await saveDraft({
            id: String(payload.id),
            userId: data.userId,
            payload: validated,
            createdAt: new Date().toISOString(),
          });
          onDone("Draft stored on this device. Not synchronised.");
          return;
        }
      }
      if (kind === "inspection") {
        resource = "inspections";
        payload = {
          project_id: projectId,
          title: str("title"),
          due_date: str("due_date") || null,
          issue_id: str("issue_id") || null,
          responses: [
            {
              question: str("question"),
              result: str("result"),
              note: str("note"),
            },
          ],
        };
      }
      if (kind === "action") {
        resource = "actions";
        payload = {
          project_id: projectId,
          title: str("title"),
          issue_id: str("issue_id"),
          due_date: str("due_date") || null,
          assignee_id: str("assignee_id") || null,
        };
      }
      if (kind === "invitation") {
        resource = "invitations";
        payload = {
          organisation_id: data.organisationId,
          project_id: projectId || null,
          email: str("email"),
          role: str("role"),
        };
      }
      if (kind === "accept-invitation") {
        resource = "accept-invitation";
        payload = { token: str("token") };
      }
      const response = await fetch(`/api/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const file = form.get("file");
      if (kind === "issue" && file instanceof File && file.size) {
        try {
          await uploadEvidence(result.id, file);
        } catch {
          onDone(
            "Issue saved, but evidence upload failed. Open the issue to retry.",
          );
          return;
        }
      }
      onDone(
        result.token
          ? `Invitation token (share securely with the invitee): ${result.token}`
          : "Saved to the server.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }
  const projectIssues = data.issues.filter((i) => i.project_id === projectId);
  return (
    <form onSubmit={submit} className="edit-form">
      {["project", "alignment", "organisation"].includes(kind) && (
        <label>
          Name
          <input
            name="name"
            required
            minLength={2}
            maxLength={160}
            placeholder={
              kind === "organisation"
                ? "Your company"
                : "e.g. Main carriageway · MC01"
            }
          />
        </label>
      )}
      {kind === "project" && (
        <>
          <label>
            Location
            <input name="location" placeholder="Western Sydney, NSW" />
          </label>
          <label>
            Description
            <textarea name="description" rows={3} />
          </label>
        </>
      )}
      {["project", "alignment"].includes(kind) && (
        <div className="form-grid">
          <label>
            Start chainage
            <input name="start" placeholder="CH 0+000" required />
          </label>
          <label>
            End chainage
            <input name="end" placeholder="CH 10+000" required />
          </label>
        </div>
      )}
      {kind === "alignment" && (
        <>
          <label>
            GeoJSON LineString
            <input
              name="geojson"
              type="file"
              accept=".json,.geojson"
              required
            />
          </label>
          <label>
            Calibration segments (optional JSON)
            <textarea
              name="calibration"
              rows={4}
              placeholder={
                '[{"distance_start":0,"distance_end":1000,"chainage_start":0,"chainage_end":1000}]'
              }
            />
          </label>
          <p className="hint">
            Leave calibration empty until verified. Each segment maps geometric
            distance to chainage; discontinuities are represented by separate
            segments.
          </p>
        </>
      )}
      {["issue", "inspection", "action"].includes(kind) && (
        <label>
          Title
          <input
            name="title"
            required
            minLength={3}
            maxLength={200}
            placeholder="Describe the finding or work"
          />
        </label>
      )}
      {kind === "issue" && (
        <>
          <div className="form-grid">
            <label>
              Alignment
              <select
                value={alignmentId}
                onChange={(e) => setAlignmentId(e.target.value)}
                required
              >
                <option value="">Select alignment</option>
                {data.alignments
                  .filter((a) => a.project_id === projectId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Severity
              <select name="severity" defaultValue="Medium">
                {["Critical", "High", "Medium", "Low"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          </div>
          <label>
            Category
            <select name="category">
              {[
                "Defect",
                "Non-conformance",
                "Safety",
                "Environmental",
                "Observation",
              ].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Start chainage
              <input
                value={chainage}
                onChange={(e) => setChainage(e.target.value)}
                placeholder="CH 3+450"
                required
              />
            </label>
            <label>
              End chainage (optional)
              <input name="end" placeholder="CH 3+570" />
            </label>
          </div>
          <div className="form-grid">
            <label>
              Lateral offset (m)
              <input type="number" name="offset" defaultValue="0" step="0.01" />
            </label>
            <label>
              Due date
              <input name="due_date" type="date" />
            </label>
          </div>
          <button type="button" onClick={capture}>
            <LocateFixed size={16} /> Capture GPS location
          </button>
          <p className="hint" role="status">
            {gpsMessage ||
              (gps
                ? `${gps.lat.toFixed(6)}, ${gps.lon.toFixed(6)} · manually selected on map`
                : "GPS location and chainage are recorded separately.")}
          </p>
          <label>
            Description
            <textarea name="description" rows={3} />
          </label>
          <label>
            Evidence photo or PDF
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              capture="environment"
            />
          </label>
          <p className="hint">
            Up to 10 MB. Files upload directly to private storage and are
            quarantined until scanned.
          </p>
        </>
      )}
      {["inspection", "action"].includes(kind) && (
        <>
          <label>
            Linked issue
            <select name="issue_id" required={kind === "action"}>
              <option value="">Select issue</option>
              {projectIssues.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.reference} · {i.title}
                </option>
              ))}
            </select>
          </label>
          <label>
            Due date
            <input name="due_date" type="date" />
          </label>
        </>
      )}
      {kind === "inspection" && (
        <>
          <label>
            Checklist question
            <input
              name="question"
              required
              placeholder="Does the work meet the specification?"
            />
          </label>
          <label>
            Result
            <select name="result">
              <option value="pass">Pass</option>
              <option value="fail">Fail</option>
              <option value="na">Not applicable</option>
            </select>
          </label>
          <label>
            Notes
            <textarea name="note" />
          </label>
        </>
      )}
      {kind === "action" && (
        <label>
          Assigned to
          <select name="assignee_id">
            <option value="">Unassigned</option>
            {data.members
              .filter((m) => m.project_id === projectId)
              .map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id} ({m.role})
                </option>
              ))}
          </select>
        </label>
      )}
      {kind === "invitation" && (
        <>
          <label>
            Invitee email
            <input type="email" name="email" required />
          </label>
          <label>
            Role
            <select name="role">
              {["viewer", "engineer", "inspector", "manager", "admin"].map(
                (r) => (
                  <option key={r}>{r}</option>
                ),
              )}
            </select>
          </label>
          <p className="hint">
            Creates an expiring invitation token. Share it securely with the
            invitee; they must sign in using this email and accept it in
            Administration.
          </p>
        </>
      )}
      {kind === "accept-invitation" && (
        <label>
          Invitation token
          <input name="token" required minLength={64} maxLength={64} />
        </label>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="form-footer">
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : kind === "issue" ? "Create issue" : "Save"}
        </button>
      </div>
    </form>
  );
}
