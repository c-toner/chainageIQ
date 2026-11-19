import type { StyleSpecification } from "maplibre-gl";
export type BasemapMode = "street" | "satellite";
export const NSW_BOUNDS: [number, number, number, number] = [
  140, -38, 154, -28,
];
const attribution =
  '© <a href="https://www.spatial.nsw.gov.au/" target="_blank" rel="noopener">NSW Spatial Services</a> · <a href="https://www.data.nsw.gov.au/data/dataset/nsw-imagery" target="_blank" rel="noopener">Imagery sources & currency</a>';
export function resolveBasemap(
  mode: BasemapMode,
  custom?: string,
): { style: string | StyleSpecification; regional: boolean } {
  if (custom?.trim()) return { style: custom.trim(), regional: false };
  const satellite = mode === "satellite";
  return {
    regional: true,
    style: {
      version: 8,
      sources: {
        basemap: {
          type: "raster",
          tiles: [
            satellite
              ? "https://portal.spatial.nsw.gov.au/aid/tile/rest/services/NSWWebImagery/MapServer/tile/{z}/{y}/{x}"
              : "https://maps.six.nsw.gov.au/arcgis/rest/services/public/NSW_Base_Map/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          minzoom: 0,
          maxzoom: satellite ? 20 : 21,
          bounds: NSW_BOUNDS,
          attribution,
        },
      },
      layers: [
        {
          id: "background",
          type: "background",
          paint: { "background-color": "#e7eeea" },
        },
        {
          id: "basemap",
          type: "raster",
          source: "basemap",
          paint: { "raster-fade-duration": 200 },
        },
      ],
    },
  };
}
export function withinNSW(lng: number, lat: number) {
  return (
    lng >= NSW_BOUNDS[0] &&
    lng <= NSW_BOUNDS[2] &&
    lat >= NSW_BOUNDS[1] &&
    lat <= NSW_BOUNDS[3]
  );
}
