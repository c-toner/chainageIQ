"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Alignment, Issue } from "@/lib/types";
import { formatChainage } from "@/lib/chainage";
export default function IssueMap({
  issues,
  alignments,
  onSelect,
  onLocation,
}: {
  issues: Issue[];
  alignments: Alignment[];
  onSelect: (i: Issue) => void;
  onLocation?: (lon: number, lat: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const [satellite, setSatellite] = useState(false),
    [error, setError] = useState("");
  const callbacks = useRef({ onSelect, onLocation });
  useEffect(() => {
    callbacks.current = { onSelect, onLocation };
  }, [onSelect, onLocation]);
  const style = satellite
    ? process.env.NEXT_PUBLIC_SATELLITE_STYLE_URL
    : process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  useEffect(() => {
    if (!container.current) return;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const m = new maplibregl.Map({
      container: container.current,
      style: style || {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: { "background-color": "#e7eeea" },
          },
        ],
      },
      center: [150.76, -33.74],
      zoom: 11,
    });
    map.current = m;
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
    );
    m.on("error", () =>
      setError(
        "Map tiles could not be loaded. Check the map provider configuration.",
      ),
    );
    m.on("load", () => {
      m.addSource("alignments", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: alignments.map((a) => ({
            type: "Feature",
            properties: { name: a.name },
            geometry: a.geometry,
          })),
        },
      });
      m.addLayer({
        id: "alignment-halo",
        type: "line",
        source: "alignments",
        paint: { "line-color": "#fff", "line-width": 9 },
      });
      m.addLayer({
        id: "alignment-line",
        type: "line",
        source: "alignments",
        paint: { "line-color": "#246c56", "line-width": 4 },
      });
      m.addSource("issues", {
        type: "geojson",
        cluster: true,
        clusterRadius: 45,
        data: {
          type: "FeatureCollection",
          features: issues
            .filter((i) => i.longitude !== null && i.latitude !== null)
            .map((i) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [i.longitude!, i.latitude!],
              },
              properties: { id: i.id, severity: i.severity },
            })),
        },
      });
      m.addLayer({
        id: "clusters",
        type: "circle",
        source: "issues",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#173f35",
          "circle-radius": 22,
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 3,
        },
      });
      m.addLayer({
        id: "points",
        type: "circle",
        source: "issues",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match",
            ["get", "severity"],
            "Critical",
            "#d35140",
            "High",
            "#d28c32",
            "Medium",
            "#3975a1",
            "#558278",
          ],
          "circle-radius": 9,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#fff",
        },
      });
      // Local canvas glyphs keep cluster counts available without a remote font service.
      for (let count = 2; count <= 99; count++) {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const context = canvas.getContext("2d");
        if (context) {
          context.fillStyle = "#ffffff";
          context.font = "bold 26px sans-serif";
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(count === 99 ? "99+" : String(count), 32, 33);
          m.addImage(`cluster-${count}`, context.getImageData(0, 0, 64, 64));
        }
      }
      m.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "issues",
        filter: ["has", "point_count"],
        layout: {
          "icon-image": [
            "concat",
            "cluster-",
            ["to-string", ["min", 99, ["get", "point_count"]]],
          ],
          "icon-size": 0.5,
          "icon-allow-overlap": true,
        },
      });
      m.on("click", "points", (e) => {
        const item = issues.find(
          (i) => i.id === e.features?.[0]?.properties.id,
        );
        if (item) callbacks.current.onSelect(item);
      });
      m.on("click", "clusters", async (e) => {
        const f = e.features?.[0];
        if (f?.geometry.type !== "Point") return;
        const zoom = await (
          m.getSource("issues") as maplibregl.GeoJSONSource
        ).getClusterExpansionZoom(f.properties.cluster_id);
        m.easeTo({ center: f.geometry.coordinates as [number, number], zoom });
      });
      m.on("click", (e) => {
        if (
          !m.queryRenderedFeatures(e.point, { layers: ["points", "clusters"] })
            .length
        )
          callbacks.current.onLocation?.(e.lngLat.lng, e.lngLat.lat);
      });
      m.on(
        "mouseenter",
        "points",
        () => (m.getCanvas().style.cursor = "pointer"),
      );
      m.on("mouseleave", "points", () => (m.getCanvas().style.cursor = ""));
      const bounds = new maplibregl.LngLatBounds();
      for (const a of alignments) {
        for (const c of a.geometry.coordinates)
          bounds.extend(c as [number, number]);
        for (const [c, ch] of [
          [a.geometry.coordinates[0], a.start_m],
          [a.geometry.coordinates.at(-1)!, a.end_m],
        ] as const) {
          const label = document.createElement("span");
          label.className = "map-chainage";
          label.textContent = formatChainage(ch);
          new maplibregl.Marker({ element: label, anchor: "bottom" })
            .setLngLat(c as [number, number])
            .addTo(m);
        }
      }
      for (const i of issues)
        if (i.longitude !== null && i.latitude !== null)
          bounds.extend([i.longitude, i.latitude]);
      if (!bounds.isEmpty())
        m.fitBounds(bounds, { padding: 65, maxZoom: 15, duration: 0 });
    });
    return () => {
      m.remove();
      map.current = null;
    };
  }, [style, issues, alignments]);
  return (
    <div className="map-wrap">
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive geographic issue map"
      />
      <div className="map-toolbar">
        <span className="map-label">
          {style
            ? "Live geographic map"
            : "Geometry view · basemap not configured"}
        </span>
        <button
          disabled={!process.env.NEXT_PUBLIC_SATELLITE_STYLE_URL}
          onClick={() => setSatellite(!satellite)}
        >
          {satellite ? "Street" : "Satellite"}
        </button>
      </div>
      <div className="map-legend">
        <span>
          <i className="dot critical" />
          Critical
        </span>
        <span>
          <i className="dot high" />
          High
        </span>
        <span>
          <i className="dot medium" />
          Medium
        </span>
        <span>
          <i className="line-key" />
          Alignment
        </span>
      </div>
      {error && (
        <p className="map-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
