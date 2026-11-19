import { describe, it, expect } from "vitest";
import { resolveBasemap, withinNSW } from "@/lib/basemaps";
describe("basemap selection", () => {
  it.each(["satellite", "street"] as const)(
    "provides attributed raster tiles without credentials: %s",
    (mode) => {
      const map = resolveBasemap(mode);
      expect(map.regional).toBe(true);
      if (typeof map.style === "string")
        throw new Error("Expected raster configuration");
      const source = map.style.sources.basemap;
      expect(source.type).toBe("raster");
      if (source.type !== "raster") return;
      expect(source.tiles?.[0]).toContain("/tile/{z}/{y}/{x}");
      expect(source.attribution).toContain("NSW Spatial Services");
      expect(source.bounds).toHaveLength(4);
    },
  );
  it("honours explicit provider configuration", () => {
    expect(
      resolveBasemap("satellite", " https://maps.example/style.json ").style,
    ).toBe("https://maps.example/style.json");
    expect(
      resolveBasemap("satellite", "https://maps.example/style.json").regional,
    ).toBe(false);
  });
  it("handles blank configuration with a real imagery default", () => {
    expect(resolveBasemap("satellite", "  ").regional).toBe(true);
  });
  it("identifies projects outside the default regional coverage", () => {
    expect(withinNSW(150.76, -33.74)).toBe(true);
    expect(withinNSW(115.86, -31.95)).toBe(false);
  });
});
