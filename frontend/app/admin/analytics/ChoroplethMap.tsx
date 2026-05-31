import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON } from "react-leaflet";
import type { FeatureCollection, Feature } from "geojson";
import type { PathOptions, Layer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { getWardBoundaries } from "../lib/adminApi";

interface ChoroplethMapProps {
  onWardClick: (wardName: string) => void;
}

function getWardColor(count: number): string {
  if (count === 0) return "#f0f4f8";
  if (count < 5) return "#81e6d9";
  if (count < 15) return "#f6ad55";
  if (count < 30) return "#ed8936";
  return "#e53e3e";
}

export default function ChoroplethMap({ onWardClick }: ChoroplethMapProps) {
  const [boundaries, setBoundaries] = useState<FeatureCollection | null>(null);
  // CR-05: track fetch errors so the user gets visible feedback instead of a
  // blank map that looks identical to a city with no ward geometry.
  const [fetchError, setFetchError] = useState<boolean>(false);

  useEffect(() => {
    getWardBoundaries()
      .then(setBoundaries)
      .catch(() => setFetchError(true));
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {fetchError && (
        <div
          role="alert"
          style={{
            padding: "10px 14px",
            marginBottom: 8,
            borderRadius: "var(--r-md)",
            background: "var(--danger-bg, #fff5f5)",
            color: "var(--danger-ink, #c53030)",
            fontSize: 13,
            border: "1px solid var(--danger-border, #feb2b2)",
          }}
        >
          Failed to load ward boundaries. The choropleth map will not show data.
        </div>
      )}
      <MapContainer
        center={[12.9716, 77.5946]}
        zoom={11}
        style={{ height: 400, borderRadius: "var(--r-lg)" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {boundaries && (
          <GeoJSON
            key={boundaries.features.map(f => f.properties?.ward_number).join(',')}
            data={boundaries}
            style={(feature?: Feature): PathOptions => ({
              fillColor: getWardColor(
                (feature?.properties?.unresolved_count as number | undefined) ?? 0
              ),
              fillOpacity: 0.6,
              weight: 1,
              color: "#4a5568",
            })}
            onEachFeature={(feature: Feature, layer: Layer) => {
              layer.on("click", () => {
                if (feature.properties?.ward_name) {
                  onWardClick(feature.properties.ward_name as string);
                }
              });
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
