'use client';

import dynamicImport from 'next/dynamic';
import Link from 'next/link';
import { PUNE_STORES, type Store } from '@/lib/storeData';
import { ArrowLeft, MapPin, Navigation, Star } from 'lucide-react';

// ── Dynamic import: StoreMap (react-leaflet) must never run on the server ─────
const StoreMap = dynamicImport(() => import('@/components/StoreMap'), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur"
      style={{ height: 480 }}
    >
      <div className="flex flex-col items-center gap-4 text-gray-400">
        <span className="w-10 h-10 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin" />
        <p className="text-sm font-medium">Loading map…</p>
      </div>
    </div>
  ),
});

// ── Store rating (decorative) ─────────────────────────────────────────────────
const RATINGS: Record<string, number> = {
  zara: 4.5, hm: 4.3, westside: 4.1, trends: 4.0,
};

// ── Store Card ────────────────────────────────────────────────────────────────
function StoreCard({ store }: { store: Store }) {
  const rating = RATINGS[store.id] ?? 4.0;
  const stars  = Math.round(rating);

  return (
    <div
      className="group relative flex items-start gap-4 p-5 rounded-2xl border border-white/10
                 bg-white/5 backdrop-blur-md hover:bg-white/[0.08] hover:border-white/20
                 transition-all duration-300 hover:shadow-xl"
    >
      {/* Coloured left accent */}
      <div
        className="absolute left-0 top-4 bottom-4 w-1 rounded-full opacity-70"
        style={{ backgroundColor: store.color }}
      />

      {/* Icon bubble */}
      <div
        className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-2xl
                   shadow-lg border border-white/10"
        style={{ backgroundColor: `${store.color}22`, boxShadow: `0 4px 20px ${store.color}30` }}
      >
        {store.emoji}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-bold text-white text-base">{store.name}</h3>
          <div className="flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={11}
                className={i < stars ? 'fill-amber-400 text-amber-400' : 'text-gray-700 fill-gray-700'}
              />
            ))}
            <span className="text-xs text-gray-400 ml-1">{rating}</span>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{store.description}</p>
        <div className="flex items-center gap-1.5 mt-2">
          <MapPin size={11} className="text-gray-500 flex-shrink-0" />
          <span className="text-[11px] text-gray-500 truncate">{store.address}</span>
        </div>
      </div>
    </div>
  );
}

// ── Page content (client component) ──────────────────────────────────────────
export default function StoresContent() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/4  w-[600px] h-[600px] bg-violet-600/10 rounded-full blur-3xl" />
        <div className="absolute top-60  right-0    w-[400px] h-[400px] bg-pink-600/[0.08] rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0   w-[500px] h-[400px] bg-blue-600/[0.08] rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-10 pb-20">

        {/* Back link */}
        <Link
          href="/recommend"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white
                     transition-colors mb-8 group"
        >
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Recommendations
        </Link>

        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full
                          bg-violet-500/15 border border-violet-500/30
                          text-violet-300 text-xs font-semibold mb-5">
            <Navigation size={12} />
            Pune, Maharashtra · Live Map
          </div>

          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3
                         bg-gradient-to-r from-violet-400 via-pink-400 to-rose-400
                         bg-clip-text text-transparent">
            Nearby Fashion Stores
          </h1>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            Explore top fashion destinations in Pune. Click{' '}
            <span className="text-violet-400 font-semibold">📍 Find Stores Near Me</span>{' '}
            on the map to see distances from your location.
          </p>
        </div>

        {/* Map */}
        <div className="mb-8">
          <StoreMap height="480px" />
        </div>

        {/* Tip banner */}
        <div className="flex items-start gap-3 p-4 mb-8 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <span className="text-lg mt-0.5">💡</span>
          <p className="text-sm text-violet-200 leading-relaxed">
            <strong className="text-violet-300">Pro tip:</strong> Click any map marker to see store details.
            Use the <em>&quot;Find Stores Near Me&quot;</em> button to detect your location and view distances
            to each store in real time.
          </p>
        </div>

        {/* Store cards */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <MapPin size={18} className="text-violet-400" />
            {PUNE_STORES.length} Stores on the Map
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PUNE_STORES.map((store) => (
              <StoreCard key={store.id} store={store} />
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-gray-600 mt-12">
          Map data © OpenStreetMap contributors · Dark tiles © CARTO ·
          StyleStudio Nearby Stores v1.0
        </p>
      </div>
    </div>
  );
}
