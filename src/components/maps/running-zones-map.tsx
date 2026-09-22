"use client";

import { MapContainer, TileLayer, Marker, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { DISTRICT_COORDS } from "@/lib/districts";

const BD_CENTER: [number, number] = [23.8, 90.3];
// Loose bounds around Bangladesh so panning can't wander off into
// neighbouring countries indefinitely.
const PAN_BOUNDS: [[number, number], [number, number]] = [
  [18.5, 85.5],
  [29.5, 95.5],
];

// Classic teardrop map-pin shape (Google Maps style): a circular head
// narrowing to a point, which sits exactly on the coordinate.
function markerIcon(hasZones: boolean) {
  const w = hasZones ? 30 : 22;
  const h = hasZones ? 42 : 30;
  const fill = hasZones ? "#2563EB" : "#ffffff";
  const stroke = hasZones ? "#1D4ED8" : "#9a9290";
  const dot = hasZones ? "#ffffff" : "#9a9290";

  return L.divIcon({
    className: "",
    html: `
      <svg width="${w}" height="${h}" viewBox="0 0 28 40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.4));">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.268 21.732 0 14 0z"
          fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
        <circle cx="14" cy="14" r="5.5" fill="${dot}"/>
      </svg>
    `,
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
  });
}

export default function RunningZonesMap({
  zoneCounts,
  onSelectDistrict,
}: {
  zoneCounts: Map<string, number>;
  onSelectDistrict: (district: string) => void;
}) {
  return (
    <MapContainer
      center={BD_CENTER}
      zoom={7.4}
      minZoom={6.5}
      maxZoom={14}
      maxBounds={PAN_BOUNDS}
      maxBoundsViscosity={0.8}
      className="h-[480px] w-full rounded-2xl border border-line sm:h-[620px]"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {Object.entries(DISTRICT_COORDS).map(([district, coords]) => {
        const count = zoneCounts.get(district) ?? 0;
        return (
          <Marker
            key={district}
            position={coords}
            icon={markerIcon(count > 0)}
            eventHandlers={{ click: () => onSelectDistrict(district) }}
          >
            <Tooltip direction="top" offset={[0, -6]}>
              {district}
              {count > 0 ? ` · ${count} spot${count === 1 ? "" : "s"}` : ""}
            </Tooltip>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
