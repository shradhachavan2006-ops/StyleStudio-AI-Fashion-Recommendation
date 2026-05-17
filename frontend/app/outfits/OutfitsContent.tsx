'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import axios from '@/lib/api';
import FeedbackModal from '@/components/FeedbackModal';
import {
  ArrowLeft, Sparkles, AlertCircle, Brain, ThumbsDown, ThumbsUp,
  Bookmark, MapPin, ChevronLeft, ChevronRight, RefreshCw, Zap,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Outfit {
  _id: string;
  outfitName: string;
  description: string;
  colors: string[];
  clothingPieces: string[];
  imageUrl: string;
  theme: string;
  top?: string;
  bottom?: string;
  style?: string;
  // 4 category images from backend
  topImage?:        string;
  topColour?:       string;
  topArticle?:      string;
  bottomImage?:     string;
  bottomColour?:    string;
  bottomArticle?:   string;
  footwearImage?:   string;
  footwearColour?:  string;
  footwearArticle?: string;
  accessoryImage?:  string;
  accessoryColour?: string;
  accessoryArticle?:string;
}
interface MLRec { name:string; type:string; usage:string; color?:string; score:number; reason:string; }

// ── Category tile config ───────────────────────────────────────────────────────
const TILES = [
  { key: 'topImage',       colourKey: 'topColour',       label: 'TOP WEAR',    pieceKey: 'top' },
  { key: 'bottomImage',    colourKey: 'bottomColour',    label: 'BOTTOM WEAR', pieceKey: 'bottom' },
  { key: 'footwearImage',  colourKey: 'footwearColour',  label: 'FOOTWEAR',    pieceKey: null },
  { key: 'accessoryImage', colourKey: 'accessoryColour', label: 'ACCESSORY',   pieceKey: null },
] as const;

// ── Image tile ─────────────────────────────────────────────────────────────────
function ImageTile({ label, src, pieceName, colour }: {
  label: string; src?: string; pieceName?: string; colour?: string;
}) {
  const [err, setErr] = useState(false);
  const dotColor = colourNameToHex(colour || '');

  return (
    <div className="flex flex-col rounded-2xl overflow-hidden bg-[#13132a] border border-white/8 flex-1 min-w-0">
      <div className="relative bg-[#1a1a35] flex items-center justify-center" style={{ aspectRatio: '3/4' }}>
        {src && !err ? (
          <img
            src={src} alt={label}
            className="w-full h-full object-cover object-top hover:scale-105 transition-transform duration-500"
            onError={() => setErr(true)}
          />
        ) : (
          <div className="flex items-center justify-center w-full h-full">
            <div className="w-12 h-12 rounded-full opacity-40" style={{ backgroundColor: dotColor || '#6b7280' }} />
          </div>
        )}
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-1">{label}</p>
        {pieceName && (
          <p className="text-sm font-bold text-white leading-tight truncate" title={pieceName}>
            {pieceName}
          </p>
        )}
        {colour && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="w-3 h-3 rounded-full border border-white/20 flex-shrink-0"
              style={{ backgroundColor: dotColor }} />
            <span className="text-[10px] text-gray-400 capitalize truncate">{colour}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Map colour name to CSS hex
function colourNameToHex(colour: string): string {
  const c = colour.toLowerCase().trim();
  const map: Record<string, string> = {
    'white':'#FFFFFF',       'black':'#111111',       'navy blue':'#1E3A5F',
    'navy':'#1E3A5F',        'blue':'#4169E1',        'red':'#CC2200',
    'green':'#228B22',       'yellow':'#FFD700',      'orange':'#FF6B35',
    'purple':'#8B008B',      'pink':'#FF69B4',        'grey':'#808080',
    'gray':'#808080',        'brown':'#8B4513',       'beige':'#F5DEB3',
    'khaki':'#C8A560',       'cream':'#FFFDD0',       'maroon':'#800000',
    'olive':'#808000',       'teal':'#008080',        'coral':'#FF7F7F',
    'gold':'#FFD700',        'silver':'#C0C0C0',      'burgundy':'#800020',
    'camel':'#C19A6B',       'tan':'#D2B48C',         'mint':'#98FF98',
    'lavender':'#E6E6FA',    'peach':'#FFDAB9',       'rust':'#B7410E',
    'charcoal':'#36454F',    'mustard':'#FFDB58',     'indigo':'#4B0082',
    'violet':'#EE82EE',      'rose':'#FF007F',        'magenta':'#FF00FF',
    'turquoise':'#40E0D0',   'nude':'#E8C8A0',        'ivory':'#FFFFF0',
    'denim':'#1560BD',       'off white':'#FAF9F6',
  };
  return map[c] || map[c.split(' ')[0]] || '#6b7280';
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OutfitsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const theme = sp.get('theme');

  const [outfits,       setOutfits]      = useState<Outfit[]>([]);
  const [fetching,      setFetching]     = useState(true);
  const [generating,    setGenerating]   = useState(false);
  const [autoRefresh,   setAutoRefresh]  = useState(false);
  const [hasLoaded,     setHasLoaded]    = useState(false);
  const [error,         setError]        = useState('');
  const [mlRecs,        setMlRecs]       = useState<MLRec[]>([]);
  const [idx,           setIdx]          = useState(0);
  const [liked,         setLiked]        = useState(false);
  const [saved,         setSaved]        = useState(false);
  const [dislikedIds,   setDislikedIds]  = useState<Set<string>>(new Set());
  const [removing,      setRemoving]     = useState(false);
  const [showFeedback,  setShowFeedback] = useState(false);
  const [feedbackShown, setFeedbackShown]= useState(false);

  // Load ML recs from session
  useEffect(() => {
    try { const r = sessionStorage.getItem('ss_recommendations'); if (r) setMlRecs(JSON.parse(r)); } catch {}
  }, []);

  // Auth guard
  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  // Fetch outfits
  const fetchOutfits = useCallback(async () => {
    setFetching(true); setError('');
    try {
      const url = theme ? `/api/outfits?theme=${theme}` : '/api/outfits';
      const res = await axios.get(url);
      setOutfits(res.data.outfits ?? []);
      setIdx(0);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err.response?.data?.message || 'Failed to load outfits');
    } finally { setFetching(false); setHasLoaded(true); }
  }, [theme]);

  useEffect(() => {
    if (!user) return;
    fetchOutfits();
  }, [theme, user, fetchOutfits]);

  // Generate fresh outfits
  const generateMore = useCallback(async (silent = false) => {
    if (!theme) { router.push('/themes'); return; }
    if (!silent) setGenerating(true);
    else         setAutoRefresh(true);
    setError('');
    try {
      await axios.post('/api/outfits/generate', { theme });
      setDislikedIds(new Set());
      const res = await axios.get(`/api/outfits?theme=${theme}`);
      const fresh = res.data.outfits ?? [];
      setOutfits(fresh);
      if (!silent) setIdx(0);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      if (!silent) setError(err.response?.data?.message || 'Failed to generate outfits');
    } finally {
      setGenerating(false);
      setAutoRefresh(false);
    }
  }, [theme, router]);

  // Reset action states when outfit changes
  useEffect(() => { setLiked(false); setSaved(false); }, [idx]);

  const go = useCallback((dir: 1 | -1) => {
    setIdx(i => (i + dir + outfits.length) % outfits.length);
  }, [outfits.length]);

  const handleSave = () => {
    setSaved(v => !v);
    if (!feedbackShown) { setShowFeedback(true); setFeedbackShown(true); }
  };

  // Dislike: remove current outfit; auto-refresh when ≤2 remain
  const handleDislike = useCallback(() => {
    const outfit = outfits[idx] ?? outfits[0];
    if (!outfit || removing) return;
    setRemoving(true);
    const dislikedId = outfit._id;
    setTimeout(() => {
      setDislikedIds(prev => new Set([...prev, dislikedId]));
      setOutfits(prev => {
        const filtered = prev.filter(o => o._id !== dislikedId);
        if (filtered.length <= 2 && !generating && !autoRefresh) {
          generateMore(true);
        }
        setIdx(i => Math.min(i, Math.max(filtered.length - 1, 0)));
        return filtered;
      });
      setLiked(false); setSaved(false);
      setRemoving(false);
    }, 350);
  }, [outfits, idx, removing, generating, autoRefresh, generateMore]);

  if (loading || !user) return null;

  const current  = outfits[idx] ?? outfits[0];
  const topRec   = mlRecs[0];
  const matchPct = topRec ? Math.round(topRec.score * 100) : null;

  // ── Keyword-based piece-name resolver ─────────────────────────────────────
  const TILE_KEYWORDS: Record<string, string[]> = {
    topImage: [
      'shirt','t-shirt','tshirt','tee','blouse','top','polo',
      'kurta','kurti','sherwani','blazer','jacket','coat','suit',
      'sweater','hoodie','sweatshirt','vest','tunic','cardigan',
      'crop','gown','dress','saree','anarkali','choli','lehenga blouse',
    ],
    bottomImage: [
      'jeans','trouser','pants','shorts','skirt','legging',
      'chino','cargo','capri','palazzo','dhoti','churidar',
      'jogger','trackpant','track pant','culottes','tights',
    ],
    footwearImage: [
      'shoe','sneaker','sandal','heel','boot','loafer','flat',
      'mule','jutti','mojari','espadrille','slipper','oxford',
      'derby','stiletto','platform','wedge','pump','clog',
    ],
    accessoryImage: [
      'tie','belt','bag','tote','clutch','watch','jewelry',
      'jewel','earring','necklace','cap','hat','dupatta',
      'cufflink','pendant','brooch','ring','bracelet','scarf',
      'stole','safa','turban','backpack','wallet','purse',
      'sunglasses','glove','socks','bandana',
    ],
  };

  function getPieceName(outfit: Outfit, _pieceKey: string | null, tileKey: string): string {
    const kw = TILE_KEYWORDS[tileKey] || [];
    const found = outfit.clothingPieces.find(p => kw.some(k => p.toLowerCase().includes(k)));
    if (found) return found;
    if (tileKey === 'topImage'    && outfit.top)    return outfit.top;
    if (tileKey === 'bottomImage' && outfit.bottom) return outfit.bottom;
    return '';
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/themes"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-white transition-colors text-sm font-medium">
            <ArrowLeft size={18} /> Back to Themes
          </Link>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {theme && (
              <span className="px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold uppercase tracking-wider">
                {theme}
              </span>
            )}
            {/* Remaining counter */}
            {!fetching && outfits.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs font-semibold">
                {outfits.length} outfit{outfits.length !== 1 ? 's' : ''} remaining
              </span>
            )}
            {/* Silent refresh indicator */}
            {autoRefresh && (
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <span className="w-2.5 h-2.5 border border-emerald-400 border-t-transparent rounded-full animate-spin" />
                Loading more…
              </span>
            )}
            <Link href="/saved" className="text-sm font-medium text-purple-400 hover:underline">
              Saved →
            </Link>
          </div>
        </div>

        {/* ── Loading ── */}
        {fetching && (
          <div className="space-y-6 animate-pulse">
            <div className="h-6 w-48 bg-white/10 rounded-xl" />
            <div className="flex gap-3">
              {[0,1,2,3].map(i => <div key={i} className="flex-1 h-64 bg-white/5 rounded-2xl" />)}
            </div>
            <div className="h-16 bg-white/5 rounded-2xl" />
          </div>
        )}

        {/* ── Error ── */}
        {!fetching && error && (
          <div className="flex items-center gap-3 p-6 bg-rose-950/40 text-rose-300 rounded-2xl border border-rose-800">
            <AlertCircle size={22} /><p className="font-medium">{error}</p>
          </div>
        )}

        {/* ── All Caught Up ── */}
        {!fetching && !error && hasLoaded && outfits.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="relative mb-8">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-violet-600/20 to-pink-600/20 border border-violet-500/30 flex items-center justify-center">
                <span className="text-5xl">✨</span>
              </div>
              <div className="absolute inset-0 rounded-full animate-ping bg-violet-500/10" />
            </div>
            <h2 className="text-2xl font-extrabold text-white mb-2">All caught up!</h2>
            <p className="text-gray-400 max-w-sm mb-8 leading-relaxed">
              You&apos;ve seen all {theme ? `${theme} ` : ''}outfits. Generate a fresh batch tailored just for you.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => generateMore()}
                disabled={generating}
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl
                           bg-gradient-to-r from-violet-600 to-pink-600
                           text-white font-bold text-sm shadow-lg shadow-violet-500/25
                           hover:opacity-90 hover:scale-[1.02] disabled:opacity-60
                           disabled:cursor-not-allowed transition-all duration-200"
              >
                {generating ? (
                  <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles size={16} /> Generate More Outfits</>
                )}
              </button>
              <Link href="/themes"
                className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl
                           border-2 border-white/15 text-gray-400 font-bold text-sm
                           hover:border-white/30 hover:text-white transition-all duration-200">
                <ArrowLeft size={15} /> Change Theme
              </Link>
            </div>
            {error && (
              <div className="mt-4 flex items-center gap-2 text-rose-400 text-sm">
                <AlertCircle size={14} /> {error}
              </div>
            )}
          </div>
        )}

        {/* ── Main Outfit Card ── */}
        {!fetching && !error && current && (
          <div className="space-y-5">

            {/* Outfit header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  {theme && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-gray-400 border border-white/10 px-2.5 py-1 rounded-full">
                      🗓 {theme.charAt(0).toUpperCase() + theme.slice(1)}
                    </span>
                  )}
                  {current.style && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-gray-400 border border-white/10 px-2.5 py-1 rounded-full">
                      ⭐ {current.style.charAt(0).toUpperCase() + current.style.slice(1)}
                    </span>
                  )}
                </div>
                <h1 className="text-2xl font-extrabold text-white">{current.outfitName}</h1>
                <p className="text-sm text-gray-400 mt-1 max-w-xl leading-relaxed">{current.description}</p>
              </div>
              {matchPct !== null && (
                <div className="flex-shrink-0 text-right">
                  <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase flex items-center gap-1 justify-end mb-1">
                    <Zap size={9} /> Match Score
                  </p>
                  <div className="w-36 h-2 bg-white/10 rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-700"
                      style={{ width: `${matchPct}%` }} />
                  </div>
                  <p className="text-xl font-extrabold bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
                    {matchPct}%
                  </p>
                </div>
              )}
            </div>

            {/* 4 Category Image Tiles */}
            <div className={`flex gap-3 transition-all duration-400 ${removing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
              {TILES.map(tile => (
                <ImageTile
                  key={tile.key}
                  label={tile.label}
                  src={current[tile.key as keyof Outfit] as string}
                  pieceName={getPieceName(current, tile.pieceKey, tile.key)}
                  colour={(current[tile.colourKey as keyof Outfit] as string) || ''}
                />
              ))}
            </div>

            {/* Color Palette */}
            {current.colors.length > 0 && (
              <div className="flex items-center gap-3">
                <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Color Palette</p>
                <div className="flex gap-2">
                  {current.colors.slice(0, 5).map((col, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: col }} />
                      <span className="text-[10px] text-gray-400">{col}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ML Reason */}
            {topRec?.reason && (
              <div className="flex items-start gap-3 p-4 rounded-2xl bg-violet-950/40 border border-violet-800/40">
                <Brain size={16} className="text-violet-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-violet-300 leading-relaxed">{topRec.reason}</p>
              </div>
            )}

            {/* 4 Action Buttons */}
            <div className="grid grid-cols-4 gap-3 pt-1">
              <button
                onClick={handleDislike}
                disabled={removing || outfits.length <= 1}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2
                           border-rose-500/40 text-rose-400 font-bold text-sm
                           hover:bg-rose-500/15 hover:border-rose-500
                           disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                <ThumbsDown size={16} /> Dislike
              </button>
              <button
                onClick={() => setLiked(v => !v)}
                className={`flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 font-bold text-sm transition-all
                  ${liked
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
                    : 'border-white/15 text-gray-400 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10'
                  }`}>
                <ThumbsUp size={16} fill={liked ? 'currentColor' : 'none'} /> Like
              </button>
              <button
                onClick={handleSave}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm
                           bg-gradient-to-r from-violet-600 to-pink-600 text-white border-2 border-transparent
                           hover:opacity-90 transition-all">
                <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
                {saved ? 'Saved!' : 'Save'}
              </button>
              <button
                onClick={() => router.push('/stores')}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2
                           border-emerald-500/40 text-emerald-400 font-bold text-sm
                           hover:bg-emerald-500/15 hover:border-emerald-500 transition-all">
                <MapPin size={16} /> Visit Store
              </button>
            </div>

            {/* Navigation */}
            {outfits.length > 1 && (
              <div className="flex items-center justify-between pt-2">
                <button onClick={() => go(-1)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10
                             text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-all">
                  <ChevronLeft size={16} /> Previous
                </button>
                <div className="flex gap-2">
                  {outfits.map((_, i) => (
                    <button key={i} onClick={() => setIdx(i)}
                      className={`h-1.5 rounded-full transition-all duration-300
                        ${i === idx ? 'w-8 bg-violet-500' : 'w-2 bg-white/20 hover:bg-white/40'}`} />
                  ))}
                </div>
                <button onClick={() => go(1)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10
                             text-sm font-medium text-gray-400 hover:text-white hover:border-white/30 transition-all">
                  <RefreshCw size={14} /> Next <ChevronRight size={16} />
                </button>
              </div>
            )}

            {/* ML Score breakdown */}
            {mlRecs.length > 1 && (
              <div className="mt-6 border-t border-white/8 pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-violet-400 text-xs font-semibold">
                    <Brain size={11} /> ML Picks
                  </div>
                  <span className="text-xs text-gray-500">More styles scored for you</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {mlRecs.slice(0, 6).map((rec, i) => {
                    const pct = Math.round(rec.score * 100);
                    const bar = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-violet-500' : 'bg-amber-500';
                    return (
                      <div key={i} className="bg-white/4 rounded-xl border border-white/8 p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="text-sm font-bold text-white leading-tight">{rec.name}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">{rec.type} · {rec.usage}</p>
                          </div>
                          <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{pct}%</span>
                        </div>
                        <div className="h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                          <div className={`h-full ${bar} rounded-full`} style={{ width: `${pct}%` }} />
                        </div>
                        {rec.reason && <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">✦ {rec.reason}</p>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showFeedback && <FeedbackModal onClose={() => setShowFeedback(false)} />}
    </div>
  );
}
