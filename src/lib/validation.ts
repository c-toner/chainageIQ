import { z } from "zod";
import { statuses } from "./types";
const uuid = z.string().uuid();
const metres = z.number().finite().min(0).max(10000000);
const point = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
]);
export const alignmentSchema = z
  .object({
    project_id: uuid,
    name: z.string().trim().min(2).max(160),
    start_m: metres,
    end_m: metres,
    geometry: z.object({
      type: z.literal("LineString"),
      coordinates: z.array(point).min(2).max(20000),
    }),
    calibration: z
      .array(
        z
          .object({
            distance_start: metres,
            distance_end: metres,
            chainage_start: metres,
            chainage_end: metres,
          })
          .refine(
            (s) =>
              s.distance_end > s.distance_start &&
              s.chainage_end > s.chainage_start,
          ),
      )
      .max(100)
      .default([]),
  })
  .refine((v) => v.end_m > v.start_m, "End must follow start")
  .refine(
    (v) =>
      v.calibration.every(
        (s, i) =>
          s.chainage_start >= v.start_m &&
          s.chainage_end <= v.end_m &&
          (i === 0 || s.distance_start >= v.calibration[i - 1].distance_end),
      ),
    "Calibration must be ordered, non-overlapping and within bounds",
  );
export const projectSchema = z
  .object({
    organisation_id: uuid,
    name: z.string().trim().min(2).max(160),
    description: z.string().max(5000).default(""),
    location: z.string().max(300).default(""),
    start_m: metres,
    end_m: metres,
  })
  .refine((v) => v.end_m > v.start_m, "End must follow start");
export const issueSchema = z
  .object({
    id: uuid.optional(),
    project_id: uuid,
    alignment_id: uuid,
    title: z.string().trim().min(3).max(200),
    description: z.string().max(10000).default(""),
    category: z.enum([
      "Defect",
      "Non-conformance",
      "Safety",
      "Environmental",
      "Observation",
    ]),
    severity: z.enum(["Critical", "High", "Medium", "Low"]),
    start_m: metres,
    end_m: metres.nullable().default(null),
    offset_m: z.number().finite().min(-10000).max(10000).default(0),
    longitude: z.number().min(-180).max(180).nullable().default(null),
    latitude: z.number().min(-90).max(90).nullable().default(null),
    accuracy_m: z.number().nonnegative().nullable().default(null),
    location_source: z.enum(["manual", "gps", "surveyed"]).default("manual"),
    assignee_id: uuid.nullable().default(null),
    due_date: z.iso.date().nullable().default(null),
  })
  .refine(
    (v) => v.end_m === null || v.end_m >= v.start_m,
    "End must follow start",
  )
  .refine(
    (v) => (v.longitude === null) === (v.latitude === null),
    "Both coordinates are required",
  );
export const updateIssueSchema = z.object({
  id: uuid,
  version: z.number().int().positive(),
  status: z.enum(statuses),
  assignee_id: uuid.nullable(),
  resolution: z.string().max(10000),
  reason: z.string().max(2000).default(""),
});
export const inspectionSchema = z.object({
  project_id: uuid,
  title: z.string().trim().min(3).max(200),
  due_date: z.iso.date().nullable(),
  issue_id: uuid.nullable(),
  responses: z
    .array(
      z.object({
        question: z.string().min(1).max(500),
        result: z.enum(["pass", "fail", "na"]),
        note: z.string().max(2000),
      }),
    )
    .min(1)
    .max(100),
});
export const actionSchema = z.object({
  project_id: uuid,
  issue_id: uuid,
  title: z.string().trim().min(3).max(200),
  due_date: z.iso.date().nullable(),
  assignee_id: uuid.nullable(),
});
export const commentSchema = z.object({
  project_id: uuid,
  issue_id: uuid,
  body: z.string().trim().min(1).max(5000),
});
