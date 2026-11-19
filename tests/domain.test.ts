import { describe, it, expect } from "vitest";
import {
  parseChainage,
  formatChainage,
  validateRange,
  calibratedChainage,
  locateOnAlignment,
} from "@/lib/chainage";
import { canTransition, csvCell } from "@/lib/workflow";
import { alignmentSchema, issueSchema } from "@/lib/validation";
import { demoData } from "@/lib/demo";
describe("chainage", () => {
  it.each([
    ["CH 0+000", 0],
    ["CH 1+250", 1250],
    ["CH 12+450", 12450],
    ["3+450.25", 3450.25],
    ["3450", 3450],
  ])("parses %s", (text, value) => expect(parseChainage(text)).toBe(value));
  it.each(["3+1450", "-20", "NaN", "3e4", "CH +450", "12+", ""])(
    "rejects %s",
    (value) => expect(() => parseChainage(value)).toThrow(),
  );
  it("formats fractional and kilometre boundaries", () => {
    expect(formatChainage(3450)).toBe("CH 3+450");
    expect(formatChainage(1999.999)).toBe("CH 2+000");
    expect(formatChainage(12.5)).toBe("CH 0+012.50");
  });
  it("validates alignment ranges", () => {
    expect(() => validateRange(3450, 3500, 0, 4000)).not.toThrow();
    expect(() => validateRange(3450, 3400, 0, 4000)).toThrow();
    expect(() => validateRange(4001, null, 0, 4000)).toThrow();
  });
  it("honours discontinuities at shared boundaries", () => {
    const s = [
      {
        distance_start: 0,
        distance_end: 1000,
        chainage_start: 0,
        chainage_end: 1000,
      },
      {
        distance_start: 1000,
        distance_end: 2000,
        chainage_start: 1500,
        chainage_end: 2500,
      },
    ];
    expect(calibratedChainage(1000, s)).toBe(1500);
    expect(calibratedChainage(2000, s)).toBe(2500);
    expect(() => calibratedChainage(2001, s)).toThrow();
  });
  it("rejects ambiguous and missing calibrations", () => {
    const s = {
      distance_start: 0,
      distance_end: 1000,
      chainage_start: 0,
      chainage_end: 1000,
    };
    expect(() => calibratedChainage(500, [s, s])).toThrow();
    expect(() =>
      locateOnAlignment(
        150,
        -33,
        [
          [150, -33],
          [150.1, -33],
        ],
        [],
      ),
    ).toThrow();
  });
  it("projects GPS onto a calibrated segment", () => {
    const found = locateOnAlignment(
      0.005,
      0,
      [
        [0, 0],
        [0.01, 0],
      ],
      [
        {
          distance_start: 0,
          distance_end: 1113.2,
          chainage_start: 1000,
          chainage_end: 2113.2,
        },
      ],
    );
    expect(found.chainage).toBeCloseTo(1556.6, 1);
    expect(found.offset).toBeCloseTo(0);
  });
});
describe("workflow permissions", () => {
  it("denies viewer writes and engineer closure", () => {
    expect(canTransition("Open", "In Progress", "viewer")).toBe(false);
    expect(
      canTransition("Ready for Review", "Closed", "engineer", "", "fixed"),
    ).toBe(false);
  });
  it("requires reviewer and resolution", () => {
    expect(
      canTransition(
        "Ready for Review",
        "Closed",
        "inspector",
        "",
        "Fixed and verified",
      ),
    ).toBe(true);
    expect(canTransition("Ready for Review", "Closed", "inspector")).toBe(
      false,
    );
    expect(canTransition("Open", "Closed", "admin", "", "fixed")).toBe(false);
  });
  it("requires a reason to reopen", () => {
    expect(canTransition("Closed", "Open", "manager")).toBe(false);
    expect(canTransition("Closed", "Open", "manager", "Defect recurred")).toBe(
      true,
    );
  });
});
describe("input and exports", () => {
  it("neutralises spreadsheet formula injection and escapes quotes", () => {
    expect(csvCell('=IMPORTXML("x")')).toBe('"\'=IMPORTXML(""x"")"');
    expect(csvCell("hello, world")).toBe('"hello, world"');
  });
  it("rejects cross-range geometry and coordinates", () => {
    const a = demoData.alignments[0];
    expect(alignmentSchema.safeParse({ ...a, end_m: -1 }).success).toBe(false);
    expect(
      alignmentSchema.safeParse({
        ...a,
        geometry: {
          type: "LineString",
          coordinates: [
            [181, 0],
            [0, 0],
          ],
        },
      }).success,
    ).toBe(false);
  });
  it("requires paired coordinates and ordered ranges", () => {
    expect(
      issueSchema.safeParse({ ...demoData.issues[0], latitude: null }).success,
    ).toBe(false);
    expect(
      issueSchema.safeParse({ ...demoData.issues[0], end_m: 1 }).success,
    ).toBe(false);
  });
});
