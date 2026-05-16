'use client';

import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import { PUNE_STORES } from '@/lib/storeData';

// ── Haversine distance (km) ───────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Helper: fly map to user position when it changes ─────────────────────────
function FlyToUser({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const prevPos = useRef<[number, number] | null>(null);
  useEffect(() => {
    if (position && position !== prevPos.current) {
      map.flyTo(position, 14, { duration: 1.4 });
      prevPos.current = position;
    }
  }, [map, position]);
  return null;
}

// ── Main StoreMap component ───────────────────────────────────────────────────
interface StoreMapProps {
  height?: string;
}

export default function StoreMap({ height = '480px' }: StoreMapProps) {
  const [userPos, setUserPos]   = useState<[number, number] | null>(null);
  const [locError, setLocError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  // Icons are lazily created inside useEffect — nothing runs at module scope.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const storeIconsRef = useRef<Map<string, any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userIconRef   = useRef<any>(null);
  const [iconsReady, setIconsReady] = useState(false);

  // ── Client-only Leaflet initialisation ───────────────────────────────────
  useEffect(() => {
    import('leaflet').then((L) => {
      // Fix default icon paths broken by webpack / Next.js
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      // Coloured teardrop icons for each store
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const map = new Map<string, any>();
      PUNE_STORES.forEach((store) => {
        map.set(
          store.id,
          L.divIcon({
            className: '',
            html: `
              <div style="
                width:44px;height:44px;
                background:${store.color};
                border-radius:50% 50% 50% 0;
                transform:rotate(-45deg);
                border:3px solid rgba(255,255,255,0.9);
                box-shadow:0 4px 15px ${store.color}80;
                display:flex;align-items:center;justify-content:center;
              ">
                <span style="transform:rotate(45deg);font-size:18px;line-height:1;">${store.emoji}</span>
              </div>
            `,
            iconSize:    [44, 44],
            iconAnchor:  [22, 44],
            popupAnchor: [0, -48],
          })
        );
      });
      storeIconsRef.current = map;

      // Blue dot for user location
      userIconRef.current = L.divIcon({
        className: '',
        html: `
          <div style="
            width:20px;height:20px;
            background:#3b82f6;
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 0 0 4px rgba(59,130,246,0.35),0 4px 12px rgba(59,130,246,0.6);
          "></div>
        `,
        iconSize:    [20, 20],
        iconAnchor:  [10, 10],
        popupAnchor: [0, -14],
      });

      setIconsReady(true);
    });
  }, []);

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocError('Geolocation is not supported by your browser.');
      return;
    }
    setLocating(true);
    setLocError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setLocating(false);
      },
      () => {
        setLocError('Location access denied. Please allow location permissions.');
        setLocating(false);
      }
    );
  }

  if (!iconsReady || !storeIconsRef.current || !userIconRef.current) {
    return (
      <div
        className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5"
        style={{ height }}
      >
        <div className="flex flex-col items-center gap-3 text-gray-400">
          <span className="w-8 h-8 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
          <p className="text-sm">Initialising map…</p>
        </div>
      </div>
    );
  }

  const PUNE_CENTER: [number, number] = [18.5204, 73.8567];

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
      style={{ height }}
    >
      {/* Locate button */}
      <button
        onClick={handleLocate}
        disabled={locating}
        className="absolute top-4 right-4 z-[1000] flex items-center gap-2 px-4 py-2.5
                   bg-gray-900/90 backdrop-blur-md border border-white/20 text-white
                   rounded-xl text-sm font-semibold shadow-lg
                   hover:bg-violet-600/80 hover:border-violet-400/60
                   active:scale-95 transition-all duration-200 disabled:opacity-60"
        title="Find stores near me"
      >
        {locating ? (
          <>
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Locating…
          </>
        ) : (
          <>📍 Find Stores Near Me</>
        )}
      </button>

      {/* Error toast */}
      {locError && (
        <div className="absolute top-16 right-4 z-[1000] bg-rose-900/90 border border-rose-500/40
                        text-rose-200 text-xs px-3 py-2 rounded-lg max-w-xs backdrop-blur-sm shadow-lg">
          {locError}
        </div>
      )}

      <MapContainer
        center={PUNE_CENTER}
        zoom={12}
        style={{ height: '100%', width: '100%' }}
        zoomControl={false}
      >
        {/* Light CartoDB tiles */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          subdomains="abcd"
          maxZoom={20}
        />

        <FlyToUser position={userPos} />

        {/* User location */}
        {userPos && userIconRef.current && (
          <>
            <Circle
              center={userPos}
              radius={1000}
              pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.1, weight: 1.5 }}
            />
            <Marker position={userPos} icon={userIconRef.current}>
              <Popup>
                <div className="text-center">
                  <p className="font-bold text-blue-700">📍 You are here</p>
                  <p className="text-xs text-gray-500 mt-1">Blue circle = 1 km radius</p>
                </div>
              </Popup>
            </Marker>
          </>
        )}

        {/* Store markers */}
        {PUNE_STORES.map((store) => {
          const icon = storeIconsRef.current?.get(store.id);
          if (!icon) return null;
          const dist = userPos
            ? haversine(userPos[0], userPos[1], store.lat, store.lng).toFixed(1)
            : null;
          return (
            <Marker key={store.id} position={[store.lat, store.lng]} icon={icon}>
              <Popup>
                <div style={{ minWidth: 185 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: store.color }}>
                    {store.emoji} {store.name}
                  </p>
                  <p style={{ fontSize: 12, color: '#444', marginBottom: 6 }}>{store.description}</p>
                  <p style={{ fontSize: 11, color: '#888' }}>📍 {store.address}</p>
                  {dist && (
                    <p style={{ fontSize: 11, fontWeight: 600, color: '#6d28d9', marginTop: 6 }}>
                      🚶 ~{dist} km away
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}
