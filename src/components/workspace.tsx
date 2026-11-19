"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  Map,
  Route,
  ClipboardList,
  ClipboardCheck,
  Wrench,
  History,
  ChartNoAxesCombined,
  Settings,
  Plus,
  Search,
  ChevronDown,
  ArrowUpRight,
  CheckCheck,
  TriangleAlert,
  Clock,
  Menu,
  X,
  CloudUpload,
  LogOut,
  SlidersHorizontal,
  Download,
  HardHat,
  Activity,
} from "lucide-react";
import type { WorkspaceData, Issue } from "@/lib/types";
import { formatChainage, parseChainage } from "@/lib/chainage";
import Dialog from "./dialog";
import CreateForm, { type FormKind } from "./create-form";
import IssueDetail from "./issue-detail";
import { listDrafts, syncDrafts, deleteDraft, type Draft } from "@/lib/offline";
const IssueMap = dynamic(() => import("./issue-map"), {
  ssr: false,
  loading: () => <div className="map-loading">Loading geographic map…</div>,
});
const navigation = [
  { name: "Dashboard", icon: LayoutDashboard },
  { name: "Projects", icon: FolderKanban },
  { name: "Interactive Map", icon: Map },
  { name: "Chainage Timeline", icon: Route },
  { name: "Issues & Defects", icon: ClipboardList },
  { name: "Inspections", icon: ClipboardCheck },
  { name: "Corrective Actions", icon: Wrench },
  { name: "Audit Trail", icon: History },
  { name: "Reports", icon: ChartNoAxesCombined },
  { name: "Administration", icon: Settings },
];
const titles: Record<string, string> = {
  Dashboard: "Project overview",
  Projects: "Your projects",
  "Interactive Map": "Every issue. In context.",
  "Chainage Timeline": "Quality along the alignment",
  "Issues & Defects": "Issue register",
  Inspections: "Inspections & hold points",
  "Corrective Actions": "Corrective actions",
  "Audit Trail": "A clear record of every change",
  Reports: "Project reporting",
  Administration: "Workspace administration",
};
function Badge({ value }: { value: string }) {
  return (
    <span className={`badge ${value.toLowerCase().replaceAll(" ", "-")}`}>
      {value}
    </span>
  );
}
export default function Workspace({
  initial,
  demo = false,
}: {
  initial: WorkspaceData;
  demo?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial),
    [view, setView] = useState("Dashboard"),
    [projectSelection, setProjectId] = useState(initial.projects[0]?.id ?? ""),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState(""),
    [severity, setSeverity] = useState(""),
    [category, setCategory] = useState(""),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [form, setForm] = useState<FormKind | null>(null),
    [selected, setSelected] = useState<Issue | null>(null),
    [mobile, setMobile] = useState(false),
    [message, setMessage] = useState(""),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [syncing, setSyncing] = useState(false),
    [mapLocation, setMapLocation] = useState<
      { lon: number; lat: number } | undefined
    >();
  useEffect(() => {
    setData(initial);
  }, [initial]);
  useEffect(() => {
    if (demo) return;
    void listDrafts(data.userId).then(setDrafts);
  }, [data.userId, demo]);
  const projectId = projectSelection || data.projects[0]?.id || "";
  const project = data.projects.find((p) => p.id === projectId);
  const projectIssues = data.issues.filter((i) => i.project_id === projectId);
  let rangeError = "";
  let min = 0,
    max = Infinity;
  try {
    min = start ? parseChainage(start) : 0;
    max = end ? parseChainage(end) : Infinity;
    if (min > max) throw new Error("Start must precede end");
  } catch (e) {
    rangeError = e instanceof Error ? e.message : "Invalid range";
  }
  const issues = projectIssues.filter(
    (i) =>
      (!status || i.status === status) &&
      (!severity || i.severity === severity) &&
      (!category || i.category === category) &&
      i.start_m >= min &&
      i.start_m <= max &&
      (!from || i.created_at >= from) &&
      (!to || i.created_at <= `${to}T23:59:59.999Z`) &&
      `${i.title} ${i.reference}`.toLowerCase().includes(query.toLowerCase()),
  );
  const alignments = useMemo(
    () => data.alignments.filter((a) => a.project_id === projectId),
    [data.alignments, projectId],
  );
  const mapIssues = useMemo(() => issues, [JSON.stringify(issues)]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = projectIssues.filter((i) => i.status !== "Closed").length,
    closed = projectIssues.length - open,
    overdue = projectIssues.filter(
      (i) =>
        i.status !== "Closed" &&
        i.due_date &&
        i.due_date < new Date().toISOString().slice(0, 10),
    ).length;
  const inspections = data.inspections.filter(
      (i) => i.project_id === projectId,
    ),
    actions = data.actions.filter((a) => a.project_id === projectId),
    events = data.audit.filter((e) => e.project_id === projectId);
  function navigate(name: string) {
    setView(name);
    setMobile(false);
  }
  function create(kind: FormKind) {
    if (demo) {
      setMessage(
        "This is a read-only demonstration. Connect Supabase to create and save records.",
      );
      return;
    }
    if (
      !projectId &&
      !["project", "organisation", "accept-invitation"].includes(kind)
    ) {
      setMessage("Create a project first.");
      return;
    }
    setForm(kind);
  }
  async function saved(text: string) {
    setMessage(text);
    setForm(null);
    setSelected(null);
    router.refresh();
    if (!demo) setDrafts(await listDrafts(data.userId));
  }
  async function sync() {
    setSyncing(true);
    try {
      const remaining = await syncDrafts(data.userId);
      setDrafts(remaining);
      setMessage(
        remaining.length
          ? "Some drafts still need attention."
          : "All queued drafts were confirmed by the server.",
      );
      router.refresh();
    } catch {
      setMessage("Could not synchronise. Drafts remain on this device.");
    } finally {
      setSyncing(false);
    }
  }
  async function change(resource: string, id: string, status: string) {
    try {
      const r = await fetch(`/api/${resource}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error);
      await saved("Update confirmed by the server.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Update failed");
    }
  }
  function exportUrl(kind = "issues", format = "csv") {
    const params = new URLSearchParams({ kind, format, project: projectId });
    for (const [k, v] of Object.entries({
      status,
      severity,
      category,
      start: start ? String(min) : "",
      end: end ? String(max) : "",
      from,
      to,
    }))
      if (v) params.set(k, v);
    return `/api/export?${params}`;
  }
  const filterBar = (
    <div className="filters">
      <div className="filter-search">
        <Search size={16} />
        <input
          aria-label="Search issues"
          placeholder="Search issues or reference…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <select
        aria-label="Filter status"
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option value="">All statuses</option>
        {["Open", "Assigned", "In Progress", "Ready for Review", "Closed"].map(
          (s) => (
            <option key={s}>{s}</option>
          ),
        )}
      </select>
      <select
        aria-label="Filter severity"
        value={severity}
        onChange={(e) => setSeverity(e.target.value)}
      >
        <option value="">All severities</option>
        {["Critical", "High", "Medium", "Low"].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <details className="more-filters">
        <summary>
          <SlidersHorizontal size={16} /> More filters
        </summary>
        <div className="extra-filters">
          <label>
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {[
                "Defect",
                "Non-conformance",
                "Safety",
                "Environmental",
                "Observation",
              ].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Start chainage
            <input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="CH 0+000"
            />
          </label>
          <label>
            End chainage
            <input
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              placeholder="CH 10+000"
            />
          </label>
          <label>
            Created from
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Created to
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
      </details>
      <span className="result-count">{issues.length} records</span>
    </div>
  );
  const table = (rows: Issue[]) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Issue / description</th>
            <th>Chainage</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Due date</th>
            <th aria-label="Open issue" />
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>
                <button className="issue-link" onClick={() => setSelected(i)}>
                  <small>
                    {i.reference} <span>· {i.category}</span>
                  </small>
                  <strong>{i.title}</strong>
                </button>
              </td>
              <td className="mono">
                {formatChainage(i.start_m)}
                {i.end_m !== null && (
                  <small>to {formatChainage(i.end_m)}</small>
                )}
              </td>
              <td>
                <Badge value={i.severity} />
              </td>
              <td>
                <Badge value={i.status} />
              </td>
              <td>
                {i.due_date
                  ? new Date(`${i.due_date}T12:00:00`).toLocaleDateString(
                      "en-AU",
                      { day: "numeric", month: "short" },
                    )
                  : "—"}
              </td>
              <td>
                <button
                  className="icon-button"
                  aria-label={`Open ${i.reference}`}
                  onClick={() => setSelected(i)}
                >
                  <ArrowUpRight size={17} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && (
        <div className="empty">
          <ClipboardList size={28} />
          <h3>No matching issues</h3>
          <p>Create an issue or adjust your filters.</p>
        </div>
      )}
    </div>
  );
  const timeline = (
    <div className="timeline-content">
      {alignments.length ? (
        alignments.map((a) => (
          <div key={a.id} className="alignment-track">
            <div className="track-label">
              <strong>{a.name}</strong>
              <span>
                {formatChainage(a.start_m)} — {formatChainage(a.end_m)}
              </span>
            </div>
            <div className="track">
              <div className="track-line" />
              {issues
                .filter((i) => i.alignment_id === a.id)
                .map((i) => (
                  <button
                    title={`${i.reference} · ${i.title} · ${formatChainage(i.start_m)}`}
                    aria-label={`${i.reference} at ${formatChainage(i.start_m)}`}
                    key={i.id}
                    className={`track-marker ${i.severity.toLowerCase()}`}
                    style={{
                      left: `${((i.start_m - a.start_m) / (a.end_m - a.start_m)) * 100}%`,
                      width: `${Math.max(1.4, (((i.end_m ?? i.start_m) - i.start_m) / (a.end_m - a.start_m)) * 100)}%`,
                    }}
                    onClick={() => setSelected(i)}
                  />
                ))}
            </div>
            <div className="track-axis">
              {[0, 0.25, 0.5, 0.75, 1].map((n) => (
                <span key={n}>
                  {formatChainage(a.start_m + (a.end_m - a.start_m) * n)}
                </span>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="empty">
          <Route size={28} />
          <h3>No alignments yet</h3>
          <p>Import a GeoJSON LineString to locate work along your project.</p>
          <button onClick={() => create("alignment")}>Import alignment</button>
        </div>
      )}
    </div>
  );
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? "is-open" : ""}`}>
        <Link className="brand" href={demo ? "/demo" : "/"}>
          <div className="brand-symbol">
            <Route size={23} />
          </div>
          <span>
            chainage<span className="brand-iq">IQ</span>
            <small>INFRASTRUCTURE INTELLIGENCE</small>
          </span>
        </Link>
        <button
          className="workspace-picker"
          onClick={() => navigate("Administration")}
        >
          <span className="workspace-avatar">WC</span>
          <span>
            {demo ? "Western Civil" : data.organisationName}
            <small>
              {demo ? "Demonstration workspace" : "Organisation workspace"}
            </small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(({ name, icon: Icon }, index) => (
            <button
              key={name}
              className={`${view === name ? "active" : ""} ${index === 8 ? "nav-divider" : ""}`}
              onClick={() => navigate(name)}
            >
              <Icon size={18} />
              <span>{name}</span>
              {name === "Issues & Defects" && <b>{projectIssues.length}</b>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="field-note">
            <HardHat size={21} />
            <div>
              Built for the field.<small>One source of project truth.</small>
            </div>
          </div>
          <button
            className="profile"
            onClick={() => navigate("Administration")}
          >
            <span className="avatar">
              {demo ? "DE" : data.userId.slice(0, 2).toUpperCase()}
            </span>
            <span>
              {demo ? "Demo engineer" : "Your account"}
              <small>{demo ? "Read-only access" : "Secure workspace"}</small>
            </span>
            <Settings size={16} />
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-overlay"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu icon-button"
            aria-label="Open navigation"
            onClick={() => setMobile(!mobile)}
          >
            <Menu />
          </button>
          <div className="breadcrumbs">
            Workspace <span>/</span> <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="sync-state">
              <span className={`status-dot ${demo ? "amber" : ""}`} />
              {demo
                ? "Demo data"
                : drafts.length
                  ? `${drafts.length} local drafts`
                  : "Live workspace"}
            </span>
            <span className="topbar-divider" />
            <span className="avatar small">
              {demo ? "DE" : data.userId.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </header>
        <main className="main-content">
          {demo && (
            <div className="demo-banner">
              <span>
                <strong>Demonstration workspace</strong> · Sample data. Changes
                are disabled.
              </span>
              <Link href="/">
                Set up live workspace <ArrowUpRight size={14} />
              </Link>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "Dashboard"
                  ? "YOUR PROJECT, AT A GLANCE"
                  : "CHAINAGEIQ WORKSPACE"}
              </div>
              <h1>{titles[view]}</h1>
              <p>
                {view === "Dashboard"
                  ? "The detail on the ground. The clarity to move forward."
                  : view === "Interactive Map"
                    ? "Select an issue marker, or click the map to create a located issue."
                    : "Connected records for confident project decisions."}
              </p>
            </div>
            <div className="page-actions">
              {[
                "Dashboard",
                "Issues & Defects",
                "Interactive Map",
                "Chainage Timeline",
              ].includes(view) && (
                <button className="primary" onClick={() => create("issue")}>
                  <Plus size={18} /> New issue
                </button>
              )}
              {view === "Projects" && (
                <button className="primary" onClick={() => create("project")}>
                  <Plus size={18} /> New project
                </button>
              )}
              {view === "Inspections" && (
                <button
                  className="primary"
                  onClick={() => create("inspection")}
                >
                  <Plus size={18} /> Record inspection
                </button>
              )}
              {view === "Corrective Actions" && (
                <button className="primary" onClick={() => create("action")}>
                  <Plus size={18} /> New action
                </button>
              )}
            </div>
          </div>
          {message && (
            <div className="message" role="status">
              <span>{message}</span>
              <button
                className="icon-button"
                aria-label="Dismiss message"
                onClick={() => setMessage("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          <div className="project-strip">
            <div>
              <FolderKanban size={18} />
              <select
                aria-label="Current project"
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value);
                  setSelected(null);
                }}
              >
                {!data.projects.length && (
                  <option value="">No projects yet</option>
                )}
                {data.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <span>
              {project?.location || "Create a project to get started"} <i />{" "}
              {project
                ? `${((project.end_m - project.start_m) / 1000).toFixed(1)} km corridor`
                : ""}
            </span>
          </div>
          {rangeError && (
            <p className="error" role="alert">
              {rangeError}
            </p>
          )}
          {view === "Dashboard" && (
            <>
              <div className="metric-grid">
                {[
                  {
                    label: "Open issues",
                    value: open,
                    detail: "Across the selected project",
                    icon: ClipboardList,
                    tone: "green",
                  },
                  {
                    label: "Critical issues",
                    value: projectIssues.filter(
                      (i) => i.severity === "Critical" && i.status !== "Closed",
                    ).length,
                    detail: "Require priority attention",
                    icon: TriangleAlert,
                    tone: "red",
                  },
                  {
                    label: "Overdue issues",
                    value: overdue,
                    detail: "Past the agreed due date",
                    icon: Clock,
                    tone: "orange",
                  },
                  {
                    label: "Closed issues",
                    value: closed,
                    detail: `${projectIssues.length ? Math.round((closed / projectIssues.length) * 100) : 0}% of recorded issues`,
                    icon: CheckCheck,
                    tone: "green",
                  },
                ].map((m) => (
                  <article className="metric" key={m.label}>
                    <div>
                      <span>{m.label}</span>
                      <m.icon size={18} className={`text-${m.tone}`} />
                    </div>
                    <strong>{String(m.value).padStart(2, "0")}</strong>
                    <small>{m.detail}</small>
                  </article>
                ))}
              </div>
              <div className="overview-grid">
                <section className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Project corridor</h2>
                      <p>Issues in their geographic context</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => navigate("Interactive Map")}
                    >
                      Explore map <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <IssueMap
                    issues={mapIssues}
                    alignments={alignments}
                    onSelect={setSelected}
                  />
                </section>
                <section className="panel quality-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Quality snapshot</h2>
                      <p>Open issues by severity</p>
                    </div>
                    <Activity size={18} />
                  </div>
                  <div className="quality-total">
                    <span>{open}</span>
                    <div>
                      items to resolve
                      <small>Keep quality moving forward.</small>
                    </div>
                  </div>
                  {["Critical", "High", "Medium", "Low"].map((s) => {
                    const count = projectIssues.filter(
                      (i) => i.severity === s && i.status !== "Closed",
                    ).length;
                    return (
                      <button
                        key={s}
                        className="severity-row"
                        onClick={() => {
                          setSeverity(s);
                          navigate("Issues & Defects");
                        }}
                      >
                        <div>
                          <span>
                            <i className={`dot ${s.toLowerCase()}`} />
                            {s}
                          </span>
                          <b>{count}</b>
                        </div>
                        <div className="bar">
                          <i
                            className={s.toLowerCase()}
                            style={{
                              width: `${open ? (count / open) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                  <div className="quality-foot">
                    <ClipboardCheck size={17} />
                    <span>
                      {
                        inspections.filter((i) => i.status === "Approved")
                          .length
                      }{" "}
                      / {inspections.length} inspections approved
                    </span>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Along the alignment</h2>
                    <p>A shared view from start to finish</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("Chainage Timeline")}
                  >
                    View timeline <ArrowUpRight size={16} />
                  </button>
                </div>
                {timeline}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Priority work</h2>
                    <p>Open items requiring your team’s attention</p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => navigate("Issues & Defects")}
                  >
                    View register <ArrowUpRight size={16} />
                  </button>
                </div>
                {table(
                  [...projectIssues]
                    .filter((i) => i.status !== "Closed")
                    .sort(
                      (a, b) =>
                        ["Critical", "High", "Medium", "Low"].indexOf(
                          a.severity,
                        ) -
                        ["Critical", "High", "Medium", "Low"].indexOf(
                          b.severity,
                        ),
                    )
                    .slice(0, 5),
                )}
              </section>
            </>
          )}
          {view === "Issues & Defects" && (
            <section className="panel">
              {filterBar}
              {table(issues)}
            </section>
          )}
          {view === "Interactive Map" && (
            <section className="panel full-map">
              {filterBar}
              <IssueMap
                issues={mapIssues}
                alignments={alignments}
                onSelect={setSelected}
                onLocation={(lon, lat) => {
                  setMapLocation({ lon, lat });
                  create("issue");
                }}
              />
              <div className="panel-caption">
                {issues.filter((i) => i.longitude === null).length} records have
                no geographic location. GPS estimates are not surveyed
                positions.
              </div>
            </section>
          )}
          {view === "Chainage Timeline" && (
            <section className="panel">
              {filterBar}
              {timeline}
              <div className="panel-caption">
                Markers show issue extents in chainage metres. Select any marker
                to inspect the record.
              </div>
              <div className="panel-footer">
                <button onClick={() => create("alignment")}>
                  <Plus size={16} /> Import alignment
                </button>
              </div>
            </section>
          )}
          {view === "Projects" && (
            <div className="project-grid">
              {data.projects.map((p) => (
                <button
                  className="project-card"
                  key={p.id}
                  onClick={() => {
                    setProjectId(p.id);
                    navigate("Dashboard");
                  }}
                >
                  <FolderKanban size={26} />
                  <h2>{p.name}</h2>
                  <p>{p.description || "Infrastructure project"}</p>
                  <small>{p.location}</small>
                  <div>
                    {formatChainage(p.start_m)} — {formatChainage(p.end_m)}
                  </div>
                  <span>
                    {
                      data.issues.filter(
                        (i) => i.project_id === p.id && i.status !== "Closed",
                      ).length
                    }{" "}
                    open issues <ArrowUpRight size={18} />
                  </span>
                </button>
              ))}
              {!data.projects.length && (
                <div className="empty">
                  <h2>Make room for your next project.</h2>
                  <p>
                    Create an organisation in Administration, then add your
                    first project.
                  </p>
                </div>
              )}
            </div>
          )}
          {view === "Inspections" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Inspection register</h2>
                  <p>Recorded checklists and independent review</p>
                </div>
              </div>
              {inspections.map((i) => (
                <article className="record-card" key={i.id}>
                  <div>
                    <h3>{i.title}</h3>
                    <p>
                      Due {i.due_date ?? "not scheduled"} · {i.responses.length}{" "}
                      checklist item(s)
                    </p>
                    <div className="checklist">
                      {i.responses.map((r, n) => (
                        <p key={n}>
                          <Badge value={r.result} />
                          <span>
                            {r.question}
                            {r.note && <small>{r.note}</small>}
                          </span>
                        </p>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Badge value={i.status} />
                    <div className="record-buttons">
                      <button
                        disabled={demo}
                        onClick={() => change("inspections", i.id, "Approved")}
                      >
                        Approve
                      </button>
                      <button
                        disabled={demo}
                        onClick={() =>
                          change("inspections", i.id, "Changes requested")
                        }
                      >
                        Request changes
                      </button>
                    </div>
                  </div>
                </article>
              ))}
              {!inspections.length && (
                <div className="empty">
                  <ClipboardCheck />
                  <h3>No inspections recorded</h3>
                  <p>
                    Record a checklist and submit it for independent review.
                  </p>
                </div>
              )}
            </section>
          )}
          {view === "Corrective Actions" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Action register</h2>
                  <p>
                    {
                      actions.filter(
                        (a) =>
                          a.status !== "Complete" &&
                          a.due_date &&
                          a.due_date < new Date().toISOString().slice(0, 10),
                      ).length
                    }{" "}
                    overdue ·{" "}
                    {actions.filter((a) => a.status === "Complete").length}{" "}
                    completed
                  </p>
                </div>
              </div>
              {actions.map((a) => (
                <article className="record-card" key={a.id}>
                  <div>
                    <small className="mono">
                      {data.issues.find((i) => i.id === a.issue_id)?.reference}
                    </small>
                    <h3>{a.title}</h3>
                    <p>
                      Due {a.due_date ?? "not set"} ·{" "}
                      {a.assignee_id?.slice(0, 8) ?? "Unassigned"}
                    </p>
                  </div>
                  <label>
                    Status
                    <select
                      aria-label={`Status for ${a.title}`}
                      disabled={demo}
                      value={a.status}
                      onChange={(e) => change("actions", a.id, e.target.value)}
                    >
                      {["Open", "In Progress", "Complete"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
              {!actions.length && (
                <div className="empty">
                  <Wrench />
                  <h3>No corrective actions</h3>
                  <p>Link new actions to an issue to track remediation.</p>
                </div>
              )}
            </section>
          )}
          {view === "Audit Trail" && (
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Project activity</h2>
                  <p>
                    Server timestamps, actor identities and historical values ·
                    latest 1,000 events
                  </p>
                </div>
              </div>
              {events.map((e) => (
                <details className="audit-row" key={e.id}>
                  <summary>
                    <span className="audit-icon">
                      <History size={17} />
                    </span>
                    <div>
                      <strong>
                        {e.action.toLowerCase()} ·{" "}
                        {e.entity_type.replaceAll("_", " ")}
                      </strong>
                      <small>
                        {e.actor_id?.slice(0, 16) ?? "System"} · {e.entity_id}
                      </small>
                    </div>
                    <time>
                      {new Date(e.created_at).toLocaleString("en-AU")}
                    </time>
                  </summary>
                  <pre>
                    {JSON.stringify(
                      { before: e.before_data, after: e.after_data },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
              {!events.length && (
                <div className="empty">
                  <History />
                  <h3>No activity recorded yet</h3>
                  <p>Significant changes will appear here automatically.</p>
                </div>
              )}
            </section>
          )}
          {view === "Reports" && (
            <>
              <section className="panel">
                {filterBar}
                <div className="report-grid">
                  {[
                    {
                      title: "Issue register",
                      kind: "issues",
                      description:
                        "Issues, chainages, owners, severity and resolution.",
                    },
                    {
                      title: "Audit report",
                      kind: "audit",
                      description:
                        "Actor identities, server timestamps and historical values.",
                    },
                  ].map((r) => (
                    <article key={r.kind}>
                      <ChartNoAxesCombined size={30} />
                      <h2>{r.title}</h2>
                      <p>{r.description}</p>
                      <div>
                        {["csv", "pdf"].map((f) =>
                          demo ? (
                            <button key={f} disabled>
                              <Download size={16} />
                              {f.toUpperCase()}
                            </button>
                          ) : (
                            <a
                              className="button"
                              key={f}
                              href={exportUrl(r.kind, f)}
                            >
                              <Download size={16} />
                              {f.toUpperCase()}
                            </a>
                          ),
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="panel-caption">
                  Exports use project, category, status, severity, chainage and
                  date filters. Audit exports use project and date filters.
                  Search text is for the on-screen register only.
                </div>
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Issues by category</h2>
                </div>
                <div className="category-chart">
                  {[
                    "Defect",
                    "Non-conformance",
                    "Safety",
                    "Environmental",
                    "Observation",
                  ].map((c) => (
                    <div key={c}>
                      <span>{c}</span>
                      <div className="bar">
                        <i
                          style={{
                            width: `${issues.length ? (issues.filter((i) => i.category === c).length / issues.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <b>{issues.filter((i) => i.category === c).length}</b>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {view === "Administration" && (
            <>
              <div className="admin-grid">
                <section className="panel admin-card">
                  <Settings size={24} />
                  <h2>{data.organisationName}</h2>
                  <p>Set up your organisation and project access.</p>
                  <div className="stack">
                    <button onClick={() => create("organisation")}>
                      Create organisation
                    </button>
                    <button onClick={() => create("invitation")}>
                      Create invitation
                    </button>
                    <button onClick={() => create("accept-invitation")}>
                      Accept invitation
                    </button>
                  </div>
                  <p className="hint">
                    Only organisation administrators can create projects and
                    invitations. Role checks are enforced by the database.
                  </p>
                  {!demo && (
                    <button
                      onClick={async () => {
                        const { createBrowserClient } =
                          await import("@supabase/ssr");
                        await createBrowserClient(
                          process.env.NEXT_PUBLIC_SUPABASE_URL!,
                          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                        ).auth.signOut();
                        router.replace("/login");
                        router.refresh();
                      }}
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  )}
                </section>
                <section className="panel admin-card">
                  <CloudUpload size={24} />
                  <h2>Field drafts</h2>
                  <p>
                    Drafts are stored on this device until the server confirms
                    they are saved.
                  </p>
                  <strong className="draft-count">
                    {drafts.length} queued
                  </strong>
                  <button
                    onClick={sync}
                    disabled={demo || syncing || !drafts.length}
                  >
                    {syncing ? "Synchronising…" : "Synchronise drafts"}
                  </button>
                  {drafts.map((d) => (
                    <div className="draft-row" key={d.id}>
                      <strong>{String(d.payload.title)}</strong>
                      <p>{d.error ?? "Awaiting synchronisation"}</p>
                      <button
                        onClick={async () => {
                          if (
                            window.confirm(
                              "Delete this unsynchronised local draft?",
                            )
                          ) {
                            await deleteDraft(d.id);
                            setDrafts(await listDrafts(data.userId));
                          }
                        }}
                      >
                        Discard draft
                      </button>
                    </div>
                  ))}
                  <p className="hint">
                    Offline drafts support new issues while the application
                    remains open. Attach photos after sync. Drafts remain on
                    this device after sign-out.
                  </p>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Project members</h2>
                </div>
                {data.members
                  .filter((m) => m.project_id === projectId)
                  .map((m) => (
                    <div key={m.user_id} className="member-row">
                      <span className="mono">{m.user_id}</span>
                      <Badge value={m.role} />
                    </div>
                  ))}
                {!data.members.filter((m) => m.project_id === projectId)
                  .length && (
                  <p className="panel-caption">
                    No explicit project memberships. Organisation administrators
                    have inherited access.
                  </p>
                )}
              </section>
            </>
          )}
          <footer className="app-footer">
            <span>
              CHAINAGEIQ <i /> Infrastructure, in focus.
            </span>
            <span>
              {demo
                ? "Sample records · No live project data"
                : "Project records · Up to 1,000 per view"}
            </span>
          </footer>
        </main>
      </div>
      {form && (
        <Dialog
          title={
            {
              issue: "Create an issue",
              project: "Create a project",
              alignment: "Import an alignment",
              inspection: "Record an inspection",
              action: "Create corrective action",
              organisation: "Create organisation",
              invitation: "Invite a team member",
              "accept-invitation": "Accept invitation",
            }[form]
          }
          onClose={() => {
            setForm(null);
            setMapLocation(undefined);
          }}
        >
          <CreateForm
            kind={form}
            data={data}
            projectId={projectId}
            location={mapLocation}
            onDone={saved}
          />
        </Dialog>
      )}
      {selected && (
        <Dialog title={selected.reference} onClose={() => setSelected(null)}>
          <IssueDetail
            issue={selected}
            data={data}
            demo={demo}
            onSaved={() => saved("Issue update confirmed by the server.")}
          />
        </Dialog>
      )}
    </div>
  );
}
