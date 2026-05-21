'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import axios from '@/lib/api';
import {
  RefreshCw, CheckCircle, AlertTriangle, XCircle, BarChart2,
  ChevronRight, RotateCcw, Tag, Search, Database, Loader2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────
interface CSVLabels {
  gender: string; masterCategory: string; subCategory: string;
  articleType: string; baseColour: string; season: string;
  year: string; usage: string; productName: string;
}
interface AutoTags {
  detectedStyle: string; detectedCategory: string;
  detectedColours: string[]; mappedUsage: string;
}
interface Sample {
  id: string; imageUrl: string; imageSizeKB: number; imageValid: boolean;
  csvLabels: CSVLabels; autoTags: AutoTags;
  generatedQuery: string; metadata: Record<string, string | number>;
}
interface Report {
  inspectedCount: number; correctCount: number;
  partialCount: number; wrongCount: number; accuracy: number;
  commonFailures: Record<string, number>;
}
type Verdict = 'correct' | 'partial' | 'wrong';

// ── Verdict config ─────────────────────────────────────────────────────────
const VERDICTS: { key: Verdict; label: string; icon: React.ReactNode; color: string; bg: string; key2: string }[] = [
  { key: 'correct', label: 'Correct',  icon: <CheckCircle size={15}/>,    color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/50 hover:bg-emerald-500/25', key2: '1' },
  { key: 'partial', label: 'Partial',  icon: <AlertTriangle size={15}/>,  color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/50 hover:bg-amber-500/25',   key2: '2' },
  { key: 'wrong',   label: 'Wrong',    icon: <XCircle size={15}/>,        color: 'text-rose-400',    bg: 'bg-rose-500/15 border-rose-500/50 hover:bg-rose-500/25',       key2: '3' },
];

// ── Small badge ────────────────────────────────────────────────────────────
function Badge({ children, color = 'violet' }: { children: React.ReactNode; color?: string }) {
  const map: Record<string, string> = {
    violet: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    blue:   'bg-blue-500/15 text-blue-300 border-blue-500/30',
    amber:  'bg-amber-500/15 text-amber-300 border-amber-500/30',
    green:  'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    rose:   'bg-rose-500/15 text-rose-300 border-rose-500/30',
    slate:  'bg-white/5 text-gray-400 border-white/10',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-semibold ${map[color] || map.slate}`}>
      {children}
    </span>
  );
}

// ── Sample Card ────────────────────────────────────────────────────────────
function SampleCard({
  sample, focused, verdict, onVerdict, onFocus,
}: {
  sample: Sample; focused: boolean; verdict?: Verdict;
  onVerdict: (v: Verdict) => void; onFocus: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const verdictColors: Record<Verdict, string> = {
    correct: 'ring-emerald-500/60',
    partial: 'ring-amber-500/60',
    wrong:   'ring-rose-500/60',
  };

  return (
    <div
      onClick={onFocus}
      className={`relative flex flex-col rounded-2xl overflow-hidden border transition-all duration-200 cursor-pointer
        ${focused ? 'border-violet-500/60 ring-2 ring-violet-500/30 shadow-lg shadow-violet-500/10' : 'border-white/8 hover:border-white/20'}
        ${verdict ? `ring-2 ${verdictColors[verdict]}` : ''}
        bg-[#0f0f24]`}
    >
      {/* Verdict badge overlay */}
      {verdict && (
        <div className={`absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border
          ${verdict === 'correct' ? 'bg-emerald-500/90 border-emerald-400 text-white' :
            verdict === 'partial' ? 'bg-amber-500/90 border-amber-400 text-white' :
            'bg-rose-500/90 border-rose-400 text-white'}`}>
          {verdict === 'correct' ? '✓' : verdict === 'partial' ? '⚠' : '✗'} {verdict}
        </div>
      )}

      {/* Image */}
      <div className="relative bg-gradient-to-b from-[#1a1a35] to-[#0f0f20]" style={{ aspectRatio: '3/4' }}>
        {!imgErr && sample.imageValid ? (
          <img src={sample.imageUrl} alt={sample.csvLabels.productName}
            className="w-full h-full object-contain"
            onError={() => setImgErr(true)} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Database size={28} className="text-gray-600" />
            <span className="text-[10px] text-gray-500">
              {sample.imageValid ? 'Load error' : `No image (${sample.imageSizeKB}KB)`}
            </span>
          </div>
        )}
        {/* ID chip */}
        <div className="absolute bottom-2 left-2">
          <span className="text-[9px] font-mono bg-black/70 text-gray-400 px-1.5 py-0.5 rounded">
            #{sample.id}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-3 flex-1">
        {/* Product name */}
        <p className="text-xs font-bold text-white leading-tight line-clamp-2">
          {sample.csvLabels.productName || sample.csvLabels.articleType}
        </p>

        {/* CSV Labels */}
        <div>
          <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-1.5 flex items-center gap-1">
            <Tag size={8}/> CSV Labels
          </p>
          <div className="flex flex-wrap gap-1">
            {sample.csvLabels.articleType && <Badge color="violet">{sample.csvLabels.articleType}</Badge>}
            {sample.csvLabels.baseColour   && <Badge color="blue">{sample.csvLabels.baseColour}</Badge>}
            {sample.csvLabels.usage        && <Badge color="amber">{sample.csvLabels.usage}</Badge>}
            {sample.csvLabels.season       && <Badge color="slate">{sample.csvLabels.season}</Badge>}
            {sample.csvLabels.gender       && <Badge color="slate">{sample.csvLabels.gender}</Badge>}
          </div>
        </div>

        {/* Auto Tags */}
        <div>
          <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-1.5">Auto Tags</p>
          <div className="flex flex-wrap gap-1">
            <Badge color="green">{sample.autoTags.detectedStyle}</Badge>
            <Badge color="green">{sample.autoTags.detectedCategory}</Badge>
            {sample.autoTags.detectedColours.slice(0, 2).map(c => (
              <Badge key={c} color="green">{c}</Badge>
            ))}
          </div>
        </div>

        {/* Generated Query */}
        <div className="bg-[#0a0a1a] rounded-lg p-2 border border-white/8">
          <p className="text-[9px] font-bold tracking-widest text-gray-500 uppercase mb-1 flex items-center gap-1">
            <Search size={8}/> CLIP Query
          </p>
          <p className="text-[10px] text-violet-300 font-mono leading-relaxed break-all">
            &quot;{sample.generatedQuery}&quot;
          </p>
        </div>

        {/* Validation Buttons */}
        <div className="grid grid-cols-3 gap-1.5 mt-auto pt-1">
          {VERDICTS.map(v => (
            <button
              key={v.key}
              onClick={e => { e.stopPropagation(); onVerdict(v.key); }}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-[10px] font-bold transition-all
                ${verdict === v.key ? `${v.bg} ${v.color} opacity-100` : `${v.bg} ${v.color} opacity-70 hover:opacity-100`}`}
            >
              {v.icon}
              <span>{v.label}</span>
              <span className="text-[8px] opacity-60">[{v.key2}]</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function DatasetInspectorPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [samples,    setSamples]    = useState<Sample[]>([]);
  const [verdicts,   setVerdicts]   = useState<Record<string, Verdict>>({});
  const [report,     setReport]     = useState<Report | null>(null);
  const [fetching,   setFetching]   = useState(false);
  const [count,      setCount]      = useState(50);
  const [onlyValid,  setOnlyValid]  = useState(true);
  const [focusedIdx, setFocusedIdx] = useState(0);
  const [error,      setError]      = useState('');

  const focusedRef = useRef(focusedIdx);
  focusedRef.current = focusedIdx;
  const samplesRef = useRef(samples);
  samplesRef.current = samples;

  useEffect(() => { if (!loading && !user) router.push('/login'); }, [user, loading, router]);

  // Load report on mount
  useEffect(() => {
    if (!user) return;
    axios.get('/api/dataset/report').then(r => setReport(r.data)).catch(() => {});
  }, [user]);

  // Fetch sample
  const fetchSample = useCallback(async () => {
    setFetching(true); setError(''); setSamples([]); setVerdicts({});
    try {
      const res = await axios.get(`/api/dataset/sample?count=${count}&onlyValid=${onlyValid}`);
      setSamples(res.data.samples || []);
      setFocusedIdx(0);
    } catch {
      setError('Failed to fetch samples. Make sure the backend is running.');
    } finally { setFetching(false); }
  }, [count, onlyValid]);

  // Submit verdict
  const submitVerdict = useCallback(async (id: string, verdict: Verdict) => {
    setVerdicts(prev => ({ ...prev, [id]: verdict }));
    const sample = samplesRef.current.find(s => s.id === id);
    try {
      const res = await axios.post('/api/dataset/validate', {
        id, verdict,
        csvLabels: sample?.csvLabels,
        autoTags:  sample?.autoTags,
        generatedQuery: sample?.generatedQuery,
      });
      setReport(res.data.report);
    } catch {}
    // Auto-advance focus
    const idx = samplesRef.current.findIndex(s => s.id === id);
    if (idx < samplesRef.current.length - 1) setFocusedIdx(idx + 1);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (['INPUT','TEXTAREA','SELECT'].includes((e.target as HTMLElement).tagName)) return;
      const s = samplesRef.current[focusedRef.current];
      if (!s) return;
      if (e.key === '1') submitVerdict(s.id, 'correct');
      if (e.key === '2') submitVerdict(s.id, 'partial');
      if (e.key === '3') submitVerdict(s.id, 'wrong');
      if (e.key === 'ArrowRight' || e.key === 'j')
        setFocusedIdx(i => Math.min(i + 1, samplesRef.current.length - 1));
      if (e.key === 'ArrowLeft' || e.key === 'k')
        setFocusedIdx(i => Math.max(i - 1, 0));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [submitVerdict]);

  const resetReport = async () => {
    if (!confirm('Reset all validation statistics?')) return;
    await axios.delete('/api/dataset/report');
    setReport({ inspectedCount: 0, correctCount: 0, partialCount: 0, wrongCount: 0, accuracy: 0, commonFailures: {} });
  };

  if (loading || !user) return null;

  const inspected = report?.inspectedCount || 0;
  const correctPct = inspected ? Math.round((report!.correctCount / inspected) * 100) : 0;
  const partialPct = inspected ? Math.round((report!.partialCount / inspected) * 100) : 0;
  const wrongPct   = inspected ? Math.round((report!.wrongCount   / inspected) * 100) : 0;
  const topFailures = Object.entries(report?.commonFailures || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="min-h-screen bg-[#080818] text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center">
              <Database size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-white">Dataset Inspector</h1>
            <span className="px-2 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[10px] font-bold uppercase tracking-wider">
              Quality Audit
            </span>
          </div>
          <p className="text-sm text-gray-400">
            Randomly sample fashion dataset entries and validate label accuracy, auto-tags, and CLIP queries.
          </p>
        </div>

        {/* ── Stats Bar ── */}
        {inspected > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Inspected', value: inspected, color: 'text-white',         icon: <BarChart2 size={14}/> },
              { label: 'Correct',   value: `${correctPct}%`, color: 'text-emerald-400', icon: <CheckCircle size={14}/> },
              { label: 'Partial',   value: `${partialPct}%`, color: 'text-amber-400',   icon: <AlertTriangle size={14}/> },
              { label: 'Wrong',     value: `${wrongPct}%`,   color: 'text-rose-400',    icon: <XCircle size={14}/> },
            ].map(s => (
              <div key={s.label} className="bg-white/4 rounded-xl border border-white/8 p-4 flex items-center gap-3">
                <div className={`${s.color} opacity-70`}>{s.icon}</div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{s.label}</p>
                  <p className={`text-xl font-extrabold ${s.color}`}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Accuracy bar ── */}
        {inspected > 0 && (
          <div className="mb-6 bg-white/4 rounded-xl border border-white/8 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-400">Overall Accuracy</p>
              <p className="text-sm font-extrabold text-white">{report?.accuracy || 0}%</p>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${correctPct}%` }} />
              <div className="h-full bg-amber-500 transition-all"   style={{ width: `${partialPct}%` }} />
              <div className="h-full bg-rose-500 transition-all"    style={{ width: `${wrongPct}%` }} />
            </div>
            <div className="flex gap-4 mt-2">
              {[['Correct','bg-emerald-500'],['Partial','bg-amber-500'],['Wrong','bg-rose-500']].map(([l,c])=>(
                <div key={l} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${c}`} />
                  <span className="text-[10px] text-gray-400">{l}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Controls ── */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-white/4 rounded-xl border border-white/8">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-400 font-semibold">Sample size</label>
            <select value={count} onChange={e => setCount(Number(e.target.value))}
              className="bg-white/8 border border-white/15 text-white text-xs rounded-lg px-2 py-1.5 outline-none">
              {[25, 50, 75, 100].map(n => <option key={n} value={n}>{n} items</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
            <input type="checkbox" checked={onlyValid} onChange={e => setOnlyValid(e.target.checked)}
              className="accent-violet-500" />
            Only valid images (&gt;5KB)
          </label>
          <button onClick={fetchSample} disabled={fetching}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600
              text-white text-xs font-bold shadow-lg hover:opacity-90 disabled:opacity-50 transition-all ml-auto">
            {fetching ? <Loader2 size={14} className="animate-spin"/> : <RefreshCw size={14}/>}
            {fetching ? 'Loading…' : 'New Random Sample'}
          </button>
          {inspected > 0 && (
            <button onClick={resetReport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-white/15 text-gray-400 text-xs font-semibold hover:text-rose-400 hover:border-rose-500/40 transition-all">
              <RotateCcw size={12}/> Reset Stats
            </button>
          )}
        </div>

        {/* ── Keyboard hint ── */}
        {samples.length > 0 && (
          <div className="flex items-center gap-4 mb-4 px-1">
            <p className="text-[10px] text-gray-500">
              <span className="font-bold text-gray-400">Keyboard:</span>{' '}
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-300">1</kbd> Correct &nbsp;
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-300">2</kbd> Partial &nbsp;
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-300">3</kbd> Wrong &nbsp;
              <kbd className="bg-white/10 px-1.5 py-0.5 rounded text-gray-300">←→</kbd> Navigate
            </p>
            <p className="text-[10px] text-gray-500 ml-auto">
              {Object.keys(verdicts).length}/{samples.length} reviewed
            </p>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 p-4 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* ── Empty state ── */}
        {!fetching && samples.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="w-20 h-20 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-6">
              <Database size={32} className="text-violet-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Ready to Inspect</h2>
            <p className="text-gray-400 text-sm mb-8 max-w-sm">
              Click &quot;New Random Sample&quot; to load a random batch from the 44K fashion dataset.
            </p>
            <button onClick={fetchSample}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 transition-all">
              <RefreshCw size={16}/> Start Inspection
            </button>
          </div>
        )}

        {/* ── Sample Grid ── */}
        {samples.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {samples.map((s, i) => (
              <SampleCard
                key={s.id}
                sample={s}
                focused={i === focusedIdx}
                verdict={verdicts[s.id]}
                onVerdict={v => submitVerdict(s.id, v)}
                onFocus={() => setFocusedIdx(i)}
              />
            ))}
          </div>
        )}

        {/* ── Common Failure Patterns ── */}
        {topFailures.length > 0 && (
          <div className="mt-10 p-5 bg-white/4 rounded-2xl border border-white/8">
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
              <XCircle size={14} className="text-rose-400"/> Common Failure Patterns
            </h3>
            <div className="flex flex-col gap-2">
              {topFailures.map(([pattern, cnt]) => (
                <div key={pattern} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 flex-1 font-mono">{pattern}</span>
                  <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${Math.min((cnt / (topFailures[0]?.[1] || 1)) * 100, 100)}%` }}/>
                  </div>
                  <span className="text-xs text-rose-400 font-bold w-8 text-right">{cnt}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Next Sample CTA ── */}
        {samples.length > 0 && Object.keys(verdicts).length === samples.length && (
          <div className="mt-8 p-6 bg-gradient-to-r from-violet-950/40 to-pink-950/40 border border-violet-500/30 rounded-2xl text-center">
            <p className="text-white font-bold mb-2">✅ Batch complete! All {samples.length} items reviewed.</p>
            <p className="text-gray-400 text-sm mb-4">Load another random sample to continue auditing.</p>
            <button onClick={fetchSample}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 text-white font-bold text-sm hover:opacity-90 transition-all">
              <ChevronRight size={16}/> Next Random Sample
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
