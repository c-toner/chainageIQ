"use client";
import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Alignment, Issue } from "@/lib/types";
import { formatChainage } from "@/lib/chainage";
import { resolveBasemap, withinNSW, type BasemapMode } from "@/lib/basemaps";

function installOverlays(
  m: maplibregl.Map,
  issues: Issue[],
  alignments: Alignment[],
) {
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
}
function issueFeatures(issues: Issue[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: issues
      .filter((i) => i.longitude !== null && i.latitude !== null)
      .map((i) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [i.longitude!, i.latitude!] },
        properties: { id: i.id, severity: i.severity },
      })),
  };
}
function alignmentFeatures(alignments: Alignment[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: alignments.map((a) => ({
      type: "Feature",
      properties: { name: a.name },
      geometry: a.geometry,
    })),
  };
}

export default function IssueMap({
  issues,
  alignments,
  onSelect,
  onLocation,
}: {
  issues: Issue[];
  alignments: Alignment[];
  onSelect: (issue: Issue) => void;
  onLocation?: (lon: number, lat: number) => void;
}) {
  const container = useRef<HTMLDivElement>(null),
    map = useRef<maplibregl.Map | null>(null);
  const dataRef = useRef({ issues, alignments, onSelect, onLocation });
  const camera = useRef<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const projectKey = alignments.map((a) => a.id).join(",");
  const fittedProject = useRef<string | null>(null);
  const [mode, setMode] = useState<BasemapMode>("satellite"),
    [retry, setRetry] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading"),
    [error, setError] = useState(""),
    [outside, setOutside] = useState(false);
  const custom =
    mode === "satellite"
      ? process.env.NEXT_PUBLIC_SATELLITE_STYLE_URL
      : process.env.NEXT_PUBLIC_MAP_STYLE_URL;
  const regional = !custom?.trim();
  const refreshLabels = useRef<() => void>(() => {});
  const fitProject = useRef<() => void>(() => {});
  useEffect(() => {
    dataRef.current = { issues, alignments, onSelect, onLocation };
    const m = map.current;
    if (!m?.getSource("issues")) return;
    (m.getSource("issues") as maplibregl.GeoJSONSource).setData(
      issueFeatures(issues),
    );
    (m.getSource("alignments") as maplibregl.GeoJSONSource).setData(
      alignmentFeatures(alignments),
    );
    refreshLabels.current();
    if (fittedProject.current !== projectKey) {
      fitProject.current();
      fittedProject.current = projectKey;
    }
  }, [issues, alignments, onSelect, onLocation, projectKey]);
  useEffect(() => {
    if (!container.current) return;
    let alive = true,
      failed = false;
    maplibregl.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
    const saved = camera.current;
    const m = new maplibregl.Map({
      container: container.current,
      style: resolveBasemap(mode, custom).style,
      center: saved?.center ?? [150.76, -33.74],
      zoom: saved?.zoom ?? 11,
      bearing: saved?.bearing ?? 0,
      pitch: saved?.pitch ?? 0,
      maxZoom: 22,
      attributionControl: false,
    });
    map.current = m;
    m.addControl(
      new maplibregl.AttributionControl({ compact: false }),
      "bottom-right",
    );
    m.addControl(new maplibregl.NavigationControl(), "top-right");
    m.addControl(
      new maplibregl.ScaleControl({ unit: "metric" }),
      "bottom-left",
    );
    m.addControl(new maplibregl.FullscreenControl(), "top-right");
    m.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
      }),
      "top-right",
    );
    const timeout = window.setTimeout(() => {
      if (alive) {
        failed = true;
        setState("error");
        setError(
          "The basemap is taking too long to load. Check your connection and retry, or switch map views.",
        );
      }
    }, 20000);
    const coverage = () => {
      if (!alive) return;
      const c = m.getCenter();
      setOutside(regional && !withinNSW(c.lng, c.lat));
    };
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(container.current);
    fitProject.current = () => {
      const bounds = new maplibregl.LngLatBounds();
      for (const a of dataRef.current.alignments)
        for (const c of a.geometry.coordinates)
          bounds.extend(c as [number, number]);
      for (const i of dataRef.current.issues)
        if (i.longitude !== null && i.latitude !== null)
          bounds.extend([i.longitude, i.latitude]);
      if (!bounds.isEmpty())
        m.fitBounds(bounds, { padding: 70, maxZoom: 17, duration: 0 });
    };
    refreshLabels.current = () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      for (const a of dataRef.current.alignments) {
        for (const [coordinate, chainage] of [
          [a.geometry.coordinates[0], a.start_m],
          [a.geometry.coordinates.at(-1), a.end_m],
        ] as const) {
          if (!coordinate) continue;
          const el = document.createElement("span");
          el.className = "map-chainage";
          el.textContent = formatChainage(chainage);
          markers.current.push(
            new maplibregl.Marker({ element: el, anchor: "bottom" })
              .setLngLat(coordinate as [number, number])
              .addTo(m),
          );
        }
      }
    };
    m.on("style.load", () => {
      if (!alive) return;
      installOverlays(m, dataRef.current.issues, dataRef.current.alignments);
      refreshLabels.current();
      const key = dataRef.current.alignments.map((a) => a.id).join(",");
      if (!saved || fittedProject.current !== key) {
        fitProject.current();
        fittedProject.current = key;
      }
      coverage();
    });
    m.on("idle", () => {
      if (!alive || failed) return;
      window.clearTimeout(timeout);
      setState("ready");
    });
    m.on("error", () => {
      if (!alive) return;
      failed = true;
      window.clearTimeout(timeout);
      setState("error");
      setError(
        "Some map tiles could not be loaded. The imagery may be incomplete. Retry or choose the other map view.",
      );
    });
    m.on("moveend", coverage);
    m.on("click", "points", (event) => {
      const issue = dataRef.current.issues.find(
        (i) => i.id === event.features?.[0]?.properties.id,
      );
      if (issue) dataRef.current.onSelect(issue);
    });
    m.on("click", "clusters", async (event) => {
      const feature = event.features?.[0];
      if (feature?.geometry.type !== "Point") return;
      try {
        const zoom = await (
          m.getSource("issues") as maplibregl.GeoJSONSource
        ).getClusterExpansionZoom(feature.properties.cluster_id);
        if (alive)
          m.easeTo({
            center: feature.geometry.coordinates as [number, number],
            zoom,
          });
      } catch {
        if (alive) setError("Unable to expand this group. Try zooming in.");
      }
    });
    m.on("click", (event) => {
      if (!m.getLayer("points")) return;
      if (
        !m.queryRenderedFeatures(event.point, {
          layers: ["points", "clusters"],
        }).length
      )
        dataRef.current.onLocation?.(event.lngLat.lng, event.lngLat.lat);
    });
    for (const layer of ["points", "clusters"]) {
      m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
    }
    return () => {
      alive = false;
      window.clearTimeout(timeout);
      observer.disconnect();
      const c = m.getCenter();
      camera.current = {
        center: [c.lng, c.lat],
        zoom: m.getZoom(),
        bearing: m.getBearing(),
        pitch: m.getPitch(),
      };
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      m.remove();
      map.current = null;
    };
  }, [mode, custom, regional, retry]);
  function switchView(next: BasemapMode) {
    if (next === mode) return;
    setState("loading");
    setError("");
    setMode(next);
  }
  function retryMap() {
    setState("loading");
    setError("");
    setRetry((n) => n + 1);
  }
  return (
    <div className="map-wrap" data-basemap={mode} data-map-state={state}>
      <div
        ref={container}
        className="map-canvas"
        aria-label="Interactive geographic issue map"
      />
      <div className="map-toolbar">
        <div className="basemap-switch" role="group" aria-label="Basemap">
          <button
            aria-pressed={mode === "street"}
            onClick={() => switchView("street")}
          >
            Street
          </button>
          <button
            aria-pressed={mode === "satellite"}
            onClick={() => switchView("satellite")}
          >
            Satellite
          </button>
        </div>
        <button onClick={() => fitProject.current()} className="fit-project">
          Fit project
        </button>
      </div>
      <div className="map-provider">
        <span>
          {regional ? "NSW Spatial Services" : "Project map provider"}
          {mode === "satellite" ? " · Aerial / satellite" : " · Street map"}
        </span>
        {regional && <small>NSW coverage · imagery dates vary</small>}
      </div>
      {state === "loading" && (
        <div className="map-loading-indicator" role="status">
          Loading {mode === "satellite" ? "imagery" : "street map"}…
        </div>
      )}
      {outside && (
        <p className="map-coverage" role="status">
          Outside the built-in NSW coverage. Configure a provider for this
          project’s region.
        </p>
      )}
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
        <div className="map-error" role="alert">
          <span>{error}</span>
          <button onClick={retryMap}>Retry map</button>
        </div>
      )}
    </div>
  );
}
