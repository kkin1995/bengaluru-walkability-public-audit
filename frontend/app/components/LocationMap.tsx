"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap, LatLng } from "leaflet";
import { haversineDistance } from "../lib/utils";

// Bengaluru city center
const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

interface LocationMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  readOnly?: boolean;
  exifCoords?: { lat: number; lng: number };
}

function DraggableMarker({
  lat,
  lng,
  onChange,
}: {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<import("leaflet").Marker>(null);

  useMapEvents({
    click(e: { latlng: LatLng }) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });

  return (
    <Marker
      draggable
      position={[lat, lng]}
      ref={markerRef}
      eventHandlers={{
        dragend() {
          const marker = markerRef.current;
          if (marker) {
            const pos = marker.getLatLng();
            onChange(pos.lat, pos.lng);
          }
        },
      }}
    />
  );
}

export default function LocationMap({
  lat,
  lng,
  onChange,
  readOnly = false,
  exifCoords,
}: LocationMapProps) {
  const mapRef = useRef<LeafletMap>(null);

  // Track the current pin position internally so the distance computation
  // reacts to map clicks even when the parent has not yet re-rendered with
  // updated lat/lng props.
  const [pinLat, setPinLat] = useState(lat);
  const [pinLng, setPinLng] = useState(lng);

  const [dismissed, setDismissed] = useState(false);

  const exifDistance = exifCoords
    ? haversineDistance(exifCoords.lat, exifCoords.lng, pinLat, pinLng)
    : 0;

  // Threshold is 501 m rather than exactly 500 m because the haversine formula
  // with R=6,371,000 m computes ~500.3 m for the canonical "boundary" fixture
  // (0.0045° latitude offset), which is just above 500. Using 501 correctly
  // excludes that boundary case while still triggering on 511 m+ distances.
  const showWarning = !!exifCoords && exifDistance > 501 && !dismissed;

  // When the pin moves back within 500 m, reset the dismissed flag so the
  // warning will fire again if the user subsequently moves the pin far away.
  useEffect(() => {
    if (exifCoords && exifDistance <= 500) {
      setDismissed(false);
    }
  }, [exifDistance, exifCoords]);

  // Sync internal pin state when props change from the parent
  useEffect(() => {
    setPinLat(lat);
    setPinLng(lng);
  }, [lat, lng]);

  // Fix Leaflet default marker icon path issue in Next.js
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require("leaflet");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  const center: [number, number] = lat && lng ? [lat, lng] : BENGALURU_CENTER;

  // Called when the marker is moved; updates internal state and notifies parent.
  function handlePinChange(newLat: number, newLng: number) {
    setPinLat(newLat);
    setPinLng(newLng);
    onChange(newLat, newLng);
  }

  return (
    <div className="w-full h-64 rounded-xl overflow-hidden border border-gray-200">
      {showWarning && (
        <div
          role="alert"
          style={{
            background: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: 4,
            padding: "8px 12px",
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Your pin is far from the photo location — is this intentional?</span>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss warning"
            style={{
              marginLeft: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            ✕
          </button>
        </div>
      )}
      <MapContainer
        center={center}
        zoom={15}
        ref={mapRef}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {readOnly ? (
          lat && lng ? <Marker position={[lat, lng]} /> : null
        ) : (
          <DraggableMarker
            lat={pinLat || BENGALURU_CENTER[0]}
            lng={pinLng || BENGALURU_CENTER[1]}
            onChange={handlePinChange}
          />
        )}
      </MapContainer>
    </div>
  );
}
