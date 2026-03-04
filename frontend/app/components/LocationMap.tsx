"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import type { Map as LeafletMap, LatLng } from "leaflet";

// Bengaluru city center
const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

interface LocationMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  readOnly?: boolean;
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
}: LocationMapProps) {
  const mapRef = useRef<LeafletMap>(null);

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

  return (
    <div className="w-full h-64 rounded-xl overflow-hidden border border-gray-200">
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
          <DraggableMarker lat={lat || BENGALURU_CENTER[0]} lng={lng || BENGALURU_CENTER[1]} onChange={onChange} />
        )}
      </MapContainer>
    </div>
  );
}
