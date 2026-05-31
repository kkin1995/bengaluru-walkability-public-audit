// frontend/app/components/HeatmapLayer.tsx
//
// WARNING: This component MUST only be rendered as a child of ReportsMap.
// ReportsMap is the dynamic+ssr:false boundary in map/page.tsx:
//   const ReportsMap = nextDynamic(() => import("../components/ReportsMap"), { ssr: false })
//
// Do NOT import HeatmapLayer directly from any page or server component —
// leaflet.heat depends on `window` and will crash with "window is not defined"
// on SSR. HeatmapLayer is SSR-safe only because it is transitively guarded by
// ReportsMap's ssr:false wrapper.
//
// MAP-02 / D-02: Shows issue-density heatmap driven by open/unresolved reports only.
// MAP-02 / D-03: Toggle lives in the native Leaflet layer control (top-right).

import "leaflet.heat";
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

interface Report {
  latitude: number;
  longitude: number;
  status: string;
}

interface HeatmapLayerProps {
  reports: Report[];
}

export default function HeatmapLayer({ reports }: HeatmapLayerProps) {
  const map = useMap();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const heatRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlRef = useRef<any>(null);

  useEffect(() => {
    // D-02: filter to open/unresolved reports only
    const openPoints = reports
      .filter((r) => r.status === "open")
      .map((r): [number, number, number] => [r.latitude, r.longitude, 1.0]);

    // leaflet.heat augments L with heatLayer via the side-effect import above
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const heatLayer = (L as any).heatLayer(openPoints, {
      radius: 25,
      blur: 15,
      maxZoom: 14,
      gradient: { 0.4: "#3388ff", 0.65: "#f5a623", 1: "#e02020" },
    });

    heatRef.current = heatLayer;

    // D-03: register as a Leaflet layers-control overlay so the user can toggle
    // it via the top-right native control rather than the chip filter strip
    const layersControl = L.control.layers(
      {},
      { "Issue Density": heatLayer },
      { position: "topright" }
    );
    layersControl.addTo(map);
    controlRef.current = layersControl;

    return () => {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
      if (heatRef.current && map.hasLayer(heatRef.current)) {
        map.removeLayer(heatRef.current);
      }
      heatRef.current = null;
    };
  }, [map, reports]);

  return null;
}
