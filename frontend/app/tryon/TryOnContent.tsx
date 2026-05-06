'use client';

/**
 * TryOnContent.tsx — Virtual Fitting Room
 *
 * Uses the fully-local AvatarViewer (components/Three/AvatarViewer.tsx)
 * No Avaturn / ReadyPlayerMe / external avatar API.
 *
 * Layout:
 *  Left sidebar  — outfit switcher thumbnails
 *  Centre-left   — AI-generated outfit image
 *  Centre-right  — 3D avatar with outfit colors applied
 *  Right panel   — outfit details + actions
 */

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import API from '@/lib/api';
import dynamic from 'next/dynamic';
import type { AvatarUserProfile, OutfitProps } from '@/components/Three/AvatarViewer';

// ── Dynamic import: Three.js must not run on the server ──────────────────────
const AvatarViewer = dynamic(
  () => import('@/components/Three/AvatarViewer'),
  { ssr: false, loading: () => <AvatarPlaceholder /> }
);

function AvatarPlaceholder() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-2xl">
      <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Outfit {
  _id: string;
  outfitName: string;
  description: string;
  colors: string[];
  clothingPieces: string[];
  imageUrl: string;
  theme: string;
  rating?: number;
}

// ── Outfit image panel ────────────────────────────────────────────────────────

function OutfitImagePanel({ outfit }: { outfit: Outfit }) {
  const [loaded, setLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  return (
    <div className="w-full h-full relative rounded-2xl overflow-hidden bg-gray-800/60 border border-gray-700/50">
      {/* Spinner while loading */}
      {!loaded && !imgError && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {imgError ? (
        /* Color palette fallback */
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Outfit palette</p>
          <div className="flex gap-3">
            {outfit.colors.map((c, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-14 h-14 rounded-2xl shadow-md border-2 border-white/20" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-gray-500 font-mono">{c}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1.5 w-full mt-2">
            {outfit.clothingPieces.slice(0, 5).map((p, i) => (
              <div key={i} className="text-xs text-gray-400 bg-gray-700/60 rounded-lg px-3 py-1.5">{p}</div>
            ))}
          </div>
        </div>
      ) : (
        <img
          src={outfit.imageUrl}
          alt={outfit.outfitName}
          className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setLoaded(true)}
          onError={() => { setImgError(true); setLoaded(true); }}
        />
      )}

      {/* Outfit name overlay */}
      {loaded && !imgError && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/75 to-transparent p-4 rounded-b-2xl">
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-widest">{outfit.theme}</span>
          <p className="text-white font-bold text-base leading-tight mt-0.5">{outfit.outfitName}</p>
        </div>
      )}

      {/* AI badge */}
      <div className="absolute top-3 left-3 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-[10px] font-bold text-violet-300 uppercase tracking-widest">
        AI Outfit
      </div>
    </div>
  );
}

// ── Composite download (canvas merge) ─────────────────────────────────────────

async function downloadComposite(
  outfitImgUrl: string,
  avatarCanvasRef: React.RefObject<HTMLCanvasElement | null>,
  outfitName: string
) {
  const W = 1200, H = 800;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#0F0F1A';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`StyleStudio — ${outfitName}`, W / 2, 46);

  // Left: outfit image
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; img.src = outfitImgUrl; });
    ctx.drawImage(img, 40, 70, 540, 700);
  } catch {
    ctx.fillStyle = '#333';
    ctx.fillRect(40, 70, 540, 700);
    ctx.fillStyle = '#888'; ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Outfit image', 310, 420);
  }

  // Right: avatar canvas snapshot
  if (avatarCanvasRef.current) {
    ctx.drawImage(avatarCanvasRef.current, 620, 70, 540, 700);
  }

  const link = document.createElement('a');
  link.download = `${outfitName.replace(/\s+/g, '_')}_tryon.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

// ── Parse avatarUrl JSON → AvatarUserProfile ──────────────────────────────────

function parseAvatarConfig(avatarUrl: string, user: any): AvatarUserProfile {
  const bc = user?.bodyCharacteristics ?? {};
  const base: AvatarUserProfile = {
    gender:    user?.gender ?? 'female',
    skinTone:  bc.skinTone  ?? 'medium',
    hairColor: bc.hairColor ?? 'dark-brown',
    bodyType:  bc.bodyType  ?? 'rectangle',
    height:    bc.height    ?? 168,
    weight:    bc.weight    ?? 65,
  };

  if (!avatarUrl) return base;
  try {
    const cfg = JSON.parse(avatarUrl);
    return {
      ...base,
      gender:    cfg.gender    ?? base.gender,
      skinTone:  cfg.skinTone  ?? base.skinTone,
      hairColor: cfg.hairColor ?? base.hairColor,
    };
  } catch {
    return base;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TryOnContent() {
  const { user, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const outfitId = searchParams.get('outfitId');
  const theme    = searchParams.get('theme') || 'casual';

  const [outfit,     setOutfit]     = useState<Outfit | null>(null);
  const [allOutfits, setAllOutfits] = useState<Outfit[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [activeTab,  setActiveTab]  = useState<'outfit' | '3d'>('outfit');

  const avatarCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Grab canvas element for composite download
  useEffect(() => {
    const id = setInterval(() => {
      const el = document.querySelector('#avatar-3d-panel canvas') as HTMLCanvasElement | null;
      if (el) { avatarCanvasRef.current = el; clearInterval(id); }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Refresh user so avatar config is fresh
  useEffect(() => { refreshUser(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load outfits
  useEffect(() => {
    async function load() {
      try {
        const res = await API.get(`/api/outfits?theme=${theme}`);
        const outfits: Outfit[] = res.data.outfits || [];
        setAllOutfits(outfits);
        const found = outfitId ? outfits.find(o => o._id === outfitId) : null;
        setOutfit(found ?? outfits[0] ?? null);
      } catch (err) {
        console.error('Failed to load outfits:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [outfitId, theme]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!outfit) return;
    setSaving(true);
    try {
      await API.post('/api/saved-designs', {
        outfitId:   outfit._id,
        outfitName: outfit.outfitName,
        theme:      outfit.theme,
        colors:     outfit.colors,
        imageUrl:   outfit.imageUrl,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  // Resolve avatar profile from stored config
  const avatarProfile: AvatarUserProfile = parseAvatarConfig(user?.avatarUrl ?? '', user);
  const outfitForViewer: OutfitProps | null = outfit
    ? { colors: outfit.colors, clothingPieces: outfit.clothingPieces }
    : null;

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Loading your fitting room…</p>
        </div>
      </div>
    );
  }

  // ── No outfit ────────────────────────────────────────────────────────────
  if (!outfit) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center text-gray-400">
          <p className="text-lg font-semibold mb-2">No outfit found</p>
          <a href="/themes" className="text-violet-400 hover:text-violet-300 text-sm underline">
            Generate outfits first →
          </a>
        </div>
      </div>
    );
  }

  // ── Main layout ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm shrink-0">
        <a
          href={`/outfits?theme=${theme}`}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to outfits
        </a>
        <h1 className="text-sm font-bold">
          <span className="text-violet-400">StyleStudio</span>
          <span className="text-gray-600 mx-2">|</span>
          Virtual Fitting Room
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => downloadComposite(outfit.imageUrl, avatarCanvasRef, outfit.outfitName)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-all"
          >
            Download
          </button>
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all
              ${saved ? 'bg-green-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white'}`}
          >
            {saved ? '✓ Saved!' : saving ? 'Saving…' : 'Save look'}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left sidebar: outfit switcher ── */}
        <div className="w-44 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 pt-4 pb-2">
            {theme} outfits
          </p>
          {allOutfits.map((o) => (
            <button
              key={o._id}
              onClick={() => setOutfit(o)}
              className={`text-left p-2 border-b border-gray-800/50 transition-all
                ${outfit._id === o._id
                  ? 'bg-violet-900/40 border-l-2 border-l-violet-500'
                  : 'hover:bg-gray-800/50'}`}
            >
              <div className="w-full aspect-square rounded-xl overflow-hidden mb-1.5 bg-gray-800">
                <img
                  src={o.imageUrl}
                  alt={o.outfitName}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <p className={`text-[11px] font-semibold leading-tight
                ${outfit._id === o._id ? 'text-violet-300' : 'text-gray-400'}`}
              >
                {o.outfitName}
              </p>
              <div className="flex gap-1 mt-1">
                {o.colors.slice(0, 3).map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full border border-gray-700" style={{ backgroundColor: c }} />
                ))}
              </div>
            </button>
          ))}
        </div>

        {/* ── Centre: fitting room ── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Mobile tabs */}
          <div className="flex border-b border-gray-800 md:hidden">
            {(['outfit', '3d'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-bold transition-colors
                  ${activeTab === tab ? 'text-violet-400 border-b-2 border-violet-400' : 'text-gray-500'}`}
              >
                {tab === '3d' ? '3D Avatar' : 'AI Outfit'}
              </button>
            ))}
          </div>

          {/* Two-panel fitting room */}
          <div className="flex-1 flex overflow-hidden p-4 gap-4">

            {/* ── Outfit image ── */}
            <div className={`flex-1 ${activeTab === '3d' ? 'hidden md:flex' : 'flex'} flex-col`}>
              <OutfitImagePanel outfit={outfit} />
            </div>

            {/* ── Divider ── */}
            <div className="hidden md:flex items-center justify-center w-6 shrink-0">
              <div className="h-full w-px bg-gray-800/70" />
            </div>

            {/* ── 3D Avatar ── */}
            <div
              id="avatar-3d-panel"
              className={`flex-1 ${activeTab === 'outfit' ? 'hidden md:flex' : 'flex'} flex-col`}
            >
              <div className="flex-1 relative rounded-2xl overflow-hidden bg-gradient-to-b from-gray-900 to-gray-950 border border-gray-700/50">

                {/* Badge */}
                <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-lg bg-black/50 backdrop-blur-sm text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  Your avatar
                </div>

                {/* Outfit color dots */}
                <div className="absolute top-3 right-3 z-10 flex gap-1.5">
                  {outfit.colors.slice(0, 3).map((c, i) => (
                    <div key={i} title={c} className="w-4 h-4 rounded-full border border-gray-600 shadow" style={{ backgroundColor: c }} />
                  ))}
                </div>

                {/* AvatarViewer — fully local, no API */}
                <AvatarViewer
                  user={avatarProfile}
                  outfit={outfitForViewer}
                  autoRotate={false}
                  showControls
                  showShadow
                />
              </div>
            </div>

          </div>
        </div>

        {/* ── Right panel: outfit details ── */}
        <div className="w-68 shrink-0 bg-gray-900 border-l border-gray-800 flex flex-col overflow-y-auto" style={{ width: 272 }}>

          {/* Header */}
          <div className="p-5 border-b border-gray-800">
            <span className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">{outfit.theme}</span>
            <h2 className="text-base font-bold text-white mt-1 leading-tight">{outfit.outfitName}</h2>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">{outfit.description}</p>
          </div>

          {/* Colour palette */}
          <div className="p-5 border-b border-gray-800">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Colour palette</p>
            <div className="flex gap-2 flex-wrap">
              {outfit.colors.map((c, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <div className="w-10 h-10 rounded-xl border border-gray-700 shadow" style={{ backgroundColor: c }} />
                  <span className="text-[9px] font-mono text-gray-500">{c}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Pieces */}
          <div className="p-5 border-b border-gray-800">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Pieces</p>
            <div className="space-y-1.5">
              {outfit.clothingPieces.map((piece, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-300 bg-gray-800/60 rounded-lg px-3 py-2">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: outfit.colors[i % outfit.colors.length] ?? '#7C3AED' }}
                  />
                  {piece}
                </div>
              ))}
            </div>
          </div>

          {/* Styling tip */}
          <div className="p-5 border-b border-gray-800">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">Styling tip</p>
            <p className="text-xs text-gray-400 leading-relaxed italic">
              The colour palette in this outfit was selected to complement your skin tone and body profile — wear it with confidence!
            </p>
          </div>

          {/* Actions */}
          <div className="p-5 mt-auto flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={saving || saved}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all
                ${saved ? 'bg-green-600 text-white' : 'bg-violet-600 hover:bg-violet-500 text-white hover:scale-[1.02]'}`}
            >
              {saved ? '✓ Saved to wardrobe!' : saving ? 'Saving…' : 'Save this look'}
            </button>
            <button
              onClick={() => downloadComposite(outfit.imageUrl, avatarCanvasRef, outfit.outfitName)}
              className="w-full py-3 rounded-xl font-bold text-sm border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-all"
            >
              Download try-on
            </button>
            <a
              href={`/outfits?theme=${theme}`}
              className="w-full py-3 rounded-xl text-sm text-center font-bold border border-gray-700 text-gray-400 hover:text-white transition-all block"
            >
              ← Try other outfits
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
