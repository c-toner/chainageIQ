export const statuses = [
  "Open",
  "Assigned",
  "In Progress",
  "Ready for Review",
  "Closed",
] as const;
export type Status = (typeof statuses)[number];
export type Role = "admin" | "manager" | "engineer" | "inspector" | "viewer";
export type Project = {
  id: string;
  organisation_id: string;
  name: string;
  description: string;
  location: string;
  start_m: number;
  end_m: number;
};
export type Alignment = {
  id: string;
  project_id: string;
  name: string;
  start_m: number;
  end_m: number;
  geometry: GeoJSON.LineString;
  calibration: Calibration[];
};
export type Calibration = {
  distance_start: number;
  distance_end: number;
  chainage_start: number;
  chainage_end: number;
};
export type Issue = {
  id: string;
  reference: string;
  project_id: string;
  alignment_id: string;
  title: string;
  description: string;
  category: string;
  severity: "Critical" | "High" | "Medium" | "Low";
  status: Status;
  start_m: number;
  end_m: number | null;
  offset_m: number;
  longitude: number | null;
  latitude: number | null;
  accuracy_m: number | null;
  location_source: "manual" | "gps" | "surveyed";
  assignee_id: string | null;
  due_date: string | null;
  resolution: string;
  version: number;
  created_at: string;
  updated_at: string;
};
export type AuditEvent = {
  id: string;
  project_id: string | null;
  actor_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
};
export type Inspection = {
  id: string;
  project_id: string;
  title: string;
  due_date: string | null;
  status: string;
  responses: {
    question: string;
    result: "pass" | "fail" | "na";
    note: string;
  }[];
  issue_id: string | null;
};
export type Action = {
  id: string;
  project_id: string;
  issue_id: string;
  title: string;
  status: string;
  due_date: string | null;
  assignee_id: string | null;
};
export type Member = { user_id: string; role: Role; project_id: string };
export type WorkspaceData = {
  projects: Project[];
  alignments: Alignment[];
  issues: Issue[];
  inspections: Inspection[];
  actions: Action[];
  audit: AuditEvent[];
  members: Member[];
  userId: string;
  organisationId: string;
  organisationName: string;
};
