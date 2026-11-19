import type { WorkspaceData, Issue } from "./types";
const project = "11111111-1111-4111-8111-111111111111",
  alignment = "22222222-2222-4222-8222-222222222222";
const base = {
  project_id: project,
  alignment_id: alignment,
  description:
    "Confirm the condition on site, record corrective work and submit evidence for inspection.",
  category: "Defect",
  start_m: 3450,
  end_m: null,
  offset_m: 0,
  longitude: 150.754,
  latitude: -33.747,
  accuracy_m: 5,
  location_source: "gps",
  assignee_id: null,
  due_date: "2026-11-20",
  resolution: "",
  version: 1,
  created_at: "2026-11-18T07:30:00Z",
  updated_at: "2026-11-18T07:30:00Z",
};
const entries = [
  ["Pavement cracking at tie-in", "High", "In Progress", 3450, "Defect"],
  [
    "Culvert headwall reinforcement cover",
    "Critical",
    "Ready for Review",
    4820,
    "Non-conformance",
  ],
  ["Sediment fence requires repair", "Medium", "Open", 2100, "Environmental"],
  ["Drainage pit lid out of tolerance", "High", "Assigned", 5680, "Defect"],
  ["Line marking inspection", "Low", "Closed", 1200, "Observation"],
  [
    "Shoulder compaction below specification",
    "High",
    "Open",
    7200,
    "Non-conformance",
  ],
  ["Pedestrian barrier damaged", "Critical", "Assigned", 6150, "Safety"],
  [
    "Surface finish at bridge approach",
    "Medium",
    "In Progress",
    8400,
    "Defect",
  ],
] as const;
export const demoData: WorkspaceData = {
  organisationId: "33333333-3333-4333-8333-333333333333",
  organisationName: "Western Civil · Demonstration",
  userId: "demo",
  projects: [
    {
      id: project,
      organisation_id: "33333333-3333-4333-8333-333333333333",
      name: "Western Sydney Road Upgrade",
      description: "Stage 2 · Earthworks, drainage and pavement",
      location: "Western Sydney, NSW",
      start_m: 0,
      end_m: 10000,
    },
  ],
  alignments: [
    {
      id: alignment,
      project_id: project,
      name: "Main carriageway · MC01",
      start_m: 0,
      end_m: 10000,
      calibration: [],
      geometry: {
        type: "LineString",
        coordinates: [
          [150.72, -33.77],
          [150.735, -33.76],
          [150.754, -33.747],
          [150.778, -33.737],
          [150.8, -33.722],
          [150.82, -33.71],
        ],
      },
    },
  ],
  issues: entries.map(
    ([title, severity, status, start_m, category], i) =>
      ({
        ...base,
        id: `44444444-4444-4444-8444-${String(i + 1).padStart(12, "0")}`,
        reference: `CIQ-${String(1042 + i)}`,
        title,
        severity,
        status,
        start_m,
        category,
        longitude: 150.72 + start_m / 100000,
        latitude: -33.77 + start_m / 166667,
        end_m: i % 3 === 0 ? start_m + 120 : null,
      }) as Issue,
  ),
  inspections: [
    {
      id: "demo-inspection",
      project_id: project,
      title: "Pavement hold point · Lot 24",
      due_date: "2026-11-21",
      status: "Submitted",
      responses: [
        { question: "Surface finish", result: "pass", note: "" },
        {
          question: "Compaction compliance",
          result: "fail",
          note: "Retest required",
        },
      ],
      issue_id: null,
    },
  ],
  actions: [
    {
      id: "demo-action",
      project_id: project,
      issue_id: "44444444-4444-4444-8444-000000000001",
      title: "Saw-cut and reinstate pavement tie-in",
      status: "In Progress",
      due_date: "2026-11-20",
      assignee_id: null,
    },
  ],
  members: [],
  audit: entries
    .slice(0, 5)
    .map((e, i) => ({
      id: `event-${i}`,
      project_id: project,
      actor_id: "Demo inspector",
      action: i % 2 ? "UPDATE" : "INSERT",
      entity_type: "issues",
      entity_id: `CIQ-${1042 + i}`,
      created_at: `2026-11-18T0${9 - i}:30:00Z`,
      before_data: null,
      after_data: { title: e[0] },
    })),
};
