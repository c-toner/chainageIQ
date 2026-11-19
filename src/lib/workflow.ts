import type { Role, Status } from "./types";
export function canTransition(
  from: Status,
  to: Status,
  role: Role,
  reason = "",
  resolution = "",
): boolean {
  if (role === "viewer") return false;
  if (from === to) return true;
  if (from === "Closed")
    return (
      to === "Open" &&
      reason.trim().length >= 5 &&
      ["admin", "manager", "inspector"].includes(role)
    );
  if (to === "Closed")
    return (
      from === "Ready for Review" &&
      ["admin", "manager", "inspector"].includes(role) &&
      resolution.trim().length >= 5
    );
  return (
    {
      Open: ["Assigned", "In Progress"],
      Assigned: ["In Progress", "Open"],
      "In Progress": ["Ready for Review", "Assigned"],
      "Ready for Review": ["In Progress"],
      Closed: [],
    } as Record<Status, Status[]>
  )[from].includes(to);
}
export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
