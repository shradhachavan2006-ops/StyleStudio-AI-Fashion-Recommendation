'use client';

import { useState } from 'react';
import { Sparkles, Loader2, AlertCircle, RotateCcw, ChevronDown } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Recommendation {
  id:     string;
  name:   string;
  image:  string;
  color:  string;
  type:   string;
  usage:  string;
  score:  number;
  reason: string;
}

interface FormState {
  skinTone:  string;
  bodyShape: string;
  gender:    string;
  usage:     string;
}

// ─── Form Options ─────────────────────────────────────────────────────────────
const SKIN_TONES  = ['Fair', 'Medium', 'Warm', 'Cool', 'Dark', 'Neutral'];
const BODY_SHAPES = ['Rectangle', 'Pear', 'Apple', 'Hourglass', 'Triangle', 'Oval', 'Inverted'];
const GENDERS     = ['Female', 'Male', 'Non-binary'];
const USAGES      = ['Casual', 'Formal', 'Sports', 'Party', 'Ethnic', 'Smart'];

// ─── Score → colour helper ────────────────────────────────────────────────────
function scorePill(score: number) {
  const pct = Math.round(score * 100);
  let cls = '';
  if (pct >= 75) cls = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
  else if (pct >= 55) cls = 'bg-amber-500/20 text-amber-400 border-amber-500/40';
  else cls = 'bg-rose-500/20 text-rose-400 border-rose-500/40';
  return { pct, cls };
}

// ─── Colour swatch helper ─────────────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
  orange: '#f97316', purple: '#a855f7', pink: '#ec4899', white: '#f9fafb',
  black: '#111827', grey: '#6b7280', gray: '#6b7280', brown: '#92400e',
  navy: '#1e3a5f', teal: '#14b8a6', coral: '#fb7185', beige: '#d9c5a7',
  olive: '#84753b', ivory: '#f5f0e8', charcoal: '#374151', gold: '#f59e0b',
  neutral: '#9ca3af', tan: '#c4a97a', peach: '#fbbf7b', lavender: '#c4b5fd',
};

function colorSwatch(name: string) {
  const hex = COLOR_MAP[name?.toLowerCase()] ?? '#6b7280';
  return hex;
}

// ─── Select Component ─────────────────────────────────────────────────────────
function Select({
  id, label, value, options, onChange, icon,
}: {
  id: string; label: string; value: string;
  options: string[]; onChange: (v: string) => void; icon?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        {icon && <span className="mr-1">{icon}</span>}{label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 pr-10
                     focus:outline-none focus:ring-2 focus:ring-violet-500/60 focus:border-violet-500/60
                     transition-all cursor-pointer text-sm"
        >
          <option value="" className="bg-gray-900">Select {label}…</option>
          {options.map(o => (
            <option key={o} value={o.toLowerCase()} className="bg-gray-900">{o}</option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden animate-pulse">
      <div className="aspect-[3/4] bg-white/10" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-white/10 rounded w-3/4" />
        <div className="h-3 bg-white/10 rounded w-1/2" />
        <div className="h-3 bg-white/10 rounded w-full" />
        <div className="h-3 bg-white/10 rounded w-5/6" />
      </div>
    </div>
  );
}

// ─── Recommendation Card ──────────────────────────────────────────────────────
function RecommendationCard({ rec, rank }: { rec: Recommendation; rank: number }) {
  const [imgErr, setImgErr] = useState(false);
  const { pct, cls } = scorePill(rec.score);
  const swatchColor   = colorSwatch(rec.color);

  return (
    <div className="group relative bg-gradient-to-b from-white/8 to-white/3 border border-white/10 rounded-2xl overflow-hidden
                    hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-900/20 transition-all duration-300">

      {/* Rank badge */}
      <div className="absolute top-3 left-3 z-10 w-7 h-7 rounded-full bg-black/60 backdrop-blur-sm
                      flex items-center justify-center text-[11px] font-bold text-white border border-white/20">
        {rank}
      </div>

      {/* Score badge */}
      <div className={`absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full border text-[11px] font-bold
                       backdrop-blur-sm ${cls}`}>
        {pct}% Match
      </div>

      {/* Image / Fallback */}
      <div className="aspect-[3/4] overflow-hidden bg-white/5 relative">
        {rec.image && !imgErr ? (
          <img
            src={rec.image}
            alt={rec.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6">
            <div
              className="w-20 h-20 rounded-2xl shadow-lg border border-white/20"
              style={{ backgroundColor: swatchColor }}
            />
            <div className="flex gap-2 flex-wrap justify-center">
              {rec.type && (
                <span className="text-[10px] text-gray-400 bg-white/10 px-2 py-0.5 rounded-full capitalize">
                  {rec.type}
                </span>
              )}
              {rec.color && (
                <span className="text-[10px] text-gray-400 bg-white/10 px-2 py-0.5 rounded-full capitalize">
                  {rec.color}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-500 text-center capitalize">{rec.name}</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Name + tags */}
        <div>
          <h3 className="font-bold text-white text-sm leading-tight">{rec.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {rec.color && (
              <span className="flex items-center gap-1 text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full capitalize">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: swatchColor }} />
                {rec.color}
              </span>
            )}
            {rec.type && (
              <span className="text-[10px] text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full capitalize">
                {rec.type}
              </span>
            )}
            {rec.usage && (
              <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 px-2 py-0.5 rounded-full capitalize">
                {rec.usage}
              </span>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] text-gray-500 font-medium">AI Score</span>
            <span className="text-[10px] font-bold text-gray-300">{pct}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* XAI Reason — the key explainability feature */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-3">
          <p className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider mb-1 flex items-center gap-1">
            <Sparkles size={9} /> Why this?
          </p>
          <p className="text-xs text-gray-300 leading-relaxed italic">
            {rec.reason}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RecommendPage() {
  const [form, setForm] = useState<FormState>({
    skinTone: '', bodyShape: '', gender: '', usage: '',
  });
  const [results,  setResults]  = useState<Recommendation[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const setField = (field: keyof FormState) => (value: string) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const isValid = form.skinTone && form.bodyShape && form.gender && form.usage;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setSearched(true);

    try {
      const res = await fetch('http://localhost:5000/api/recommend', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || body.error || `Server error ${res.status}`);
      }

      const data: Recommendation[] = await res.json();
      setResults(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm({ skinTone: '', bodyShape: '', gender: '', usage: '' });
    setResults([]);
    setError(null);
    setSearched(false);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Hero / Form Panel ── */}
      <div className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-pink-600/15 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 pt-16 pb-12">
          {/* Header */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-semibold mb-5">
              <Sparkles size={12} /> Hybrid AI · Explainable Recommendations
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3
                           bg-gradient-to-r from-violet-400 via-pink-400 to-rose-400
                           bg-clip-text text-transparent">
              Your Personal Style Engine
            </h1>
            <p className="text-gray-400 text-base max-w-xl mx-auto">
              Tell us about yourself — our hybrid ML + rule engine will find your perfect outfits and explain every recommendation.
            </p>
          </div>

          {/* Form card */}
          <form
            onSubmit={handleSubmit}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 shadow-2xl"
          >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Select id="gender"    label="Gender"     value={form.gender}    options={GENDERS}     onChange={setField('gender')}    icon="👤" />
              <Select id="skinTone"  label="Skin Tone"  value={form.skinTone}  options={SKIN_TONES}  onChange={setField('skinTone')}  icon="🎨" />
              <Select id="bodyShape" label="Body Shape" value={form.bodyShape} options={BODY_SHAPES} onChange={setField('bodyShape')} icon="👗" />
              <Select id="usage"     label="Occasion"   value={form.usage}     options={USAGES}      onChange={setField('usage')}     icon="✨" />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={!isValid || loading}
                id="recommend-submit-btn"
                className="flex-1 py-3.5 rounded-xl font-bold text-sm
                           bg-gradient-to-r from-violet-600 to-pink-600 text-white
                           hover:opacity-90 active:scale-[0.98] transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30"
              >
                {loading ? (
                  <><Loader2 size={16} className="animate-spin" /> Finding outfits…</>
                ) : (
                  <><Sparkles size={16} /> Get Recommendations</>
                )}
              </button>

              {searched && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-3.5 rounded-xl font-bold text-sm border border-white/15
                             text-gray-400 hover:text-white hover:border-white/30 transition-all
                             flex items-center gap-2"
                >
                  <RotateCcw size={14} /> Reset
                </button>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ── Results Area ── */}
      <div className="max-w-7xl mx-auto px-6 pb-20">

        {/* Loading skeletons */}
        {loading && (
          <div>
            <p className="text-center text-gray-400 text-sm mb-6 flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin text-violet-400" />
              Running hybrid ML + rule scoring across {'{'}all outfits{'}'}…
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="max-w-md mx-auto text-center py-12">
            <div className="w-14 h-14 bg-rose-500/15 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle size={24} className="text-rose-400" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Something went wrong</h3>
            <p className="text-gray-400 text-sm mb-6">{error}</p>
            <button
              onClick={handleReset}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sm font-semibold transition-all border border-white/10"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && searched && results.length === 0 && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">👗</div>
            <h3 className="font-bold text-lg text-white mb-2">No outfits found</h3>
            <p className="text-gray-400 text-sm">Try different preferences or ask an admin to seed outfits.</p>
          </div>
        )}

        {/* Results grid */}
        {!loading && !error && results.length > 0 && (
          <div>
            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  Top {results.length} Recommendations
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Ranked by Hybrid Score = 0.7 × ML + 0.3 × Rules
                </p>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-gray-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" /> ≥ 75% match
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> 55–74%
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-rose-400" /> &lt; 55%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.map((rec, i) => (
                <RecommendationCard key={rec.id} rec={rec} rank={i + 1} />
              ))}
            </div>

            {/* System info footer */}
            <div className="mt-10 text-center">
              <p className="text-[11px] text-gray-600">
                Powered by Random Forest ML · Rule Engine · Explainable AI · StyleStudio v2
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
