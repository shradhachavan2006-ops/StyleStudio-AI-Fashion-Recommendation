'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, AlertCircle, Brain, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';
import axios from '@/lib/api';
import OutfitCard from '@/components/OutfitCard';
import FeedbackModal from '@/components/FeedbackModal';

// ── Types ─────────────────────────────────────────────────────────────────────
interface MLRecommendation {
  name: string;
  type: string;
  usage: string;
  baseColour?: string;
  score: number;
  reasons: string[];
  link?: string;
}

// ── Feedback threshold ────────────────────────────────────────────────────────
function shouldShowFeedback(likes: number, saves: number, tries: number): boolean {
  return likes >= 2 || saves >= 1 || tries >= 1;
}

// ── Score colour helper ───────────────────────────────────────────────────────
function scoreColor(score: number) {
  if (score >= 0.8) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 0.6) return { bar: 'bg-violet-500',  text: 'text-violet-600 dark:text-violet-400' };
  return               { bar: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400' };
}

// ── ML Recommendation Card ────────────────────────────────────────────────────
function MLCard({ rec, rank }: { rec: MLRecommendation; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const pct = Math.round(rec.score * 100);
  const { bar, text } = scoreColor(rec.score);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 hover:shadow-lg transition-shadow">
      {/* Rank + name row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-xs font-bold flex items-center justify-center">
            {rank}
          </span>
          <div>
            <p className="font-bold text-gray-900 dark:text-white text-sm leading-snug">{rec.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{rec.type} · {rec.usage}</p>
          </div>
        </div>
        {rec.baseColour && (
          <div
            className="w-6 h-6 rounded-full flex-shrink-0 border border-gray-200 dark:border-gray-700"
            title={rec.baseColour}
            style={{ backgroundColor: rec.baseColour.toLowerCase() === 'multi' ? 'transparent' : rec.baseColour.toLowerCase() }}
          />
        )}
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] text-gray-400 font-medium">Match score</span>
          <span className={`text-[11px] font-bold ${text}`}>{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full ${bar} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* Reasons — expandable */}
      {rec.reasons.length > 0 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? 'Hide reasons' : `Why this? (${rec.reasons.length})`}
        </button>
      )}
      {expanded && (
        <ul className="mt-2 space-y-1">
          {rec.reasons.map((r, i) => (
            <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="text-violet-400 mt-0.5">•</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OutfitsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme');

  const [outfits, setOutfits] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  // ML recommendations from sessionStorage (set by themes page)
  const [mlRecs, setMlRecs] = useState<MLRecommendation[]>([]);
  const [showAllRecs, setShowAllRecs] = useState(false);

  // Feedback modal state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackShown, setFeedbackShown] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const [tryCount, setTryCount] = useState(0);

  // ── Load ML recommendations from sessionStorage ─────────────────────────────
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('ss_recommendations');
      if (raw) {
        const data = JSON.parse(raw) as MLRecommendation[];
        setMlRecs(data);
        // Don't clear immediately — clear when user leaves the page
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const fetchOutfits = async () => {
      try {
        const url = theme ? `/api/outfits?theme=${theme}` : '/api/outfits';
        const res = await axios.get(url);
        setOutfits(res.data.outfits);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to fetch outfits');
      } finally {
        setFetching(false);
      }
    };
    fetchOutfits();
  }, [theme, user]);

  const handleRate = async (id: string, rating: number) => {
    try {
      await axios.put(`/api/outfits/${id}/rate`, { rating });
      setOutfits((prev) => prev.map((o) => (o._id === id ? { ...o, rating } : o)));
    } catch (err) {
      console.error('Rating failed', err);
    }
  };

  const handleCardAction = useCallback(
    (action: 'like' | 'reject' | 'save' | 'try_on') => {
      if (feedbackShown) return;
      let nextLikes = likeCount;
      let nextSaves = saveCount;
      let nextTries = tryCount;
      if (action === 'like')   nextLikes = likeCount + 1;
      if (action === 'save')   nextSaves = saveCount + 1;
      if (action === 'try_on') nextTries = tryCount + 1;
      setLikeCount(nextLikes);
      setSaveCount(nextSaves);
      setTryCount(nextTries);
      if (shouldShowFeedback(nextLikes, nextSaves, nextTries)) {
        setShowFeedback(true);
        setFeedbackShown(true);
      }
    },
    [likeCount, saveCount, tryCount, feedbackShown]
  );

  if (loading || !user) return null;

  const visibleRecs = showAllRecs ? mlRecs : mlRecs.slice(0, 6);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header nav */}
      <div className="flex items-center justify-between mb-8">
        <Link
          href="/themes"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors"
        >
          <ArrowLeft size={20} /> Back to Themes
        </Link>
        <Link
          href="/saved"
          className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
        >
          My Saved Designs &rarr;
        </Link>
      </div>

      {/* Page title */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-sm font-medium mb-4">
          <Sparkles size={16} />
          <span>AI Stylist</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight mb-4">
          {theme ? `${theme.charAt(0).toUpperCase() + theme.slice(1)} Outfits` : 'All Outfits'}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl text-lg">
          Curated exclusively for you based on your body type, color profile, and selected occasion.
        </p>
      </div>

      {/* ── AI-Generated Outfit Images ─────────────────────────────────────── */}
      {fetching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-96 bg-gray-100 dark:bg-gray-800/50 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-6 bg-red-50 dark:bg-red-950/30 text-red-600 rounded-2xl border border-red-200">
          <AlertCircle size={24} />
          <p className="font-medium">{error}</p>
        </div>
      ) : outfits.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
          <Sparkles size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold mb-2">No outfits generated yet</h3>
          <p className="text-gray-500 mb-6">Pick a theme to generate AI outfit suggestions.</p>
          <Link
            href="/themes"
            className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold"
          >
            Pick a Theme
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {outfits.map((outfit: any) => (
            <OutfitCard
              key={outfit._id}
              outfit={outfit}
              onRatingChange={handleRate}
              onAction={handleCardAction}
            />
          ))}
        </div>
      )}

      {/* ── ML Style Picks ─────────────────────────────────────────────────── */}
      {mlRecs.length > 0 && (
        <div className="mt-16">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 text-sm font-medium">
              <Brain size={15} />
              <span>ML Engine</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <TrendingUp size={12} />
              Scored from your body profile
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">AI Style Picks</h2>
          <p className="text-sm text-gray-400 mb-6">
            Ranked by our hybrid ML + rule engine using your skin tone, body shape, and this occasion.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleRecs.map((rec, i) => (
              <MLCard key={`${rec.name}-${i}`} rec={rec} rank={i + 1} />
            ))}
          </div>

          {mlRecs.length > 6 && (
            <div className="text-center mt-6">
              <button
                onClick={() => setShowAllRecs(s => !s)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700
                           text-sm font-semibold text-gray-600 dark:text-gray-300 hover:border-violet-400 hover:text-violet-600
                           dark:hover:border-violet-500 dark:hover:text-violet-400 transition-all"
              >
                {showAllRecs ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                {showAllRecs ? 'Show less' : `Show all ${mlRecs.length} picks`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Feedback Modal */}
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}
    </div>
  );
}
