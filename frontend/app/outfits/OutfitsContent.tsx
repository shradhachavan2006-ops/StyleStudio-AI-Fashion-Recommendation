'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Sparkles, AlertCircle } from 'lucide-react';
import axios from '@/lib/api';
import OutfitCard from '@/components/OutfitCard';
import FeedbackModal from '@/components/FeedbackModal';

// Feedback threshold rules:
//   - 2 likes, OR
//   - 1 save, OR
//   - 1 try-on
function shouldShowFeedback(likes: number, saves: number, tries: number): boolean {
  return likes >= 2 || saves >= 1 || tries >= 1;
}

export default function OutfitsContent() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const theme = searchParams.get('theme');

  const [outfits, setOutfits] = useState<any[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');

  // Feedback modal state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackShown, setFeedbackShown] = useState(false); // only show once per session
  const [likeCount, setLikeCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);
  const [tryCount, setTryCount] = useState(0);

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

  // Called by each OutfitCard when a meaningful action happens
  const handleCardAction = useCallback(
    (action: 'like' | 'dislike' | 'save' | 'try') => {
      if (feedbackShown) return; // don't re-trigger after modal was shown

      let nextLikes = likeCount;
      let nextSaves = saveCount;
      let nextTries = tryCount;

      if (action === 'like') nextLikes = likeCount + 1;
      if (action === 'save') nextSaves = saveCount + 1;
      if (action === 'try')  nextTries = tryCount + 1;

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

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
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

      {/* Feedback Modal — shown after threshold is reached */}
      {showFeedback && (
        <FeedbackModal onClose={() => setShowFeedback(false)} />
      )}
    </div>
  );
}
