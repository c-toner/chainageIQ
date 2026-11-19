import type { Calibration } from "./types";
export function parseChainage(value: string): number {
  const cleaned = value.trim().replace(/^CH\s*/i, "");
  const match = /^(\d+)\+(\d{1,3}(?:\.\d+)?)$/.exec(cleaned);
  const metres = match
    ? Number(match[1]) * 1000 + Number(match[2])
    : /^\d+(?:\.\d+)?$/.test(cleaned)
      ? Number(cleaned)
      : NaN;
  if (!Number.isFinite(metres))
    throw new Error("Use chainage such as CH 3+450 or metres such as 3450.");
  return metres;
}
export function formatChainage(metres: number): string {
  const rounded = Math.round(metres * 100) / 100;
  return `CH ${Math.floor(rounded / 1000)}+${(rounded % 1000).toFixed(rounded % 1 ? 2 : 0).padStart(rounded % 1 ? 6 : 3, "0")}`;
}
export function validateRange(
  start: number,
  end: number | null,
  min: number,
  max: number,
) {
  if (
    start < min ||
    start > max ||
    (end !== null && (end < start || end > max))
  )
    throw new Error(
      "Chainage must be within the alignment and end must follow start.",
    );
}
export function calibratedChainage(
  distance: number,
  segments: Calibration[],
): number {
  const matches = segments.filter(
    (s, i) =>
      distance >= s.distance_start &&
      (distance < s.distance_end ||
        (i === segments.length - 1 && distance === s.distance_end)),
  );
  if (matches.length !== 1)
    throw new Error("No unambiguous calibration for this location.");
  const s = matches[0];
  return (
    s.chainage_start +
    ((distance - s.distance_start) / (s.distance_end - s.distance_start)) *
      (s.chainage_end - s.chainage_start)
  );
}
// Local tangent-plane projection, suitable for contractor-scale alignments. Survey verification remains required.
export function locateOnAlignment(
  lon: number,
  lat: number,
  coordinates: number[][],
  segments: Calibration[],
) {
  if (!segments.length)
    throw new Error(
      "This alignment has no calibration. Enter chainage manually.",
    );
  const scaleX = 111320 * Math.cos((lat * Math.PI) / 180),
    scaleY = 111320;
  let distance = 0,
    best = { offset: Infinity, distance: 0 };
  for (let i = 1; i < coordinates.length; i++) {
    const a = coordinates[i - 1],
      b = coordinates[i];
    const ax = (a[0] - lon) * scaleX,
      ay = (a[1] - lat) * scaleY,
      bx = (b[0] - lon) * scaleX,
      by = (b[1] - lat) * scaleY;
    const dx = bx - ax,
      dy = by - ay,
      len = Math.hypot(dx, dy);
    if (!len) continue;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (len * len)));
    const offset = Math.hypot(ax + t * dx, ay + t * dy);
    if (offset < best.offset) best = { offset, distance: distance + t * len };
    distance += len;
  }
  if (!Number.isFinite(best.offset))
    throw new Error("Alignment has no measurable segments.");
  return {
    chainage: calibratedChainage(best.distance, segments),
    offset: best.offset,
  };
}
