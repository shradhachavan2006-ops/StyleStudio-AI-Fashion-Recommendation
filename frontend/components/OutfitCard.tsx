'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ThumbsUp, ThumbsDown, Bookmark, Shirt } from 'lucide-react';
import API from '@/lib/api';

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
  occasion?: string;
  rating?: number;
}

interface OutfitCardProps {
  outfit: Outfit;
  onRatingChange?: (id: string, rating: number) => void;
  onAction?: (action: 'like' | 'reject' | 'save' | 'try_on') => void;
}

async function postAction(outfit_id: string, action_type: string) {
  try {
    await API.post('/api/actions', { outfit_id, action_type });
  } catch (err) {
    console.error(`Failed to log action [${action_type}]:`, err);
  }
}

export default function OutfitCard({ outfit, onRatingChange, onAction }: OutfitCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const viewedRef = useRef(false); // prevents duplicate view events

  const [imgError, setImgError] = useState(!outfit.imageUrl || outfit.imageUrl.trim() === '');
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rating, setRating] = useState(outfit.rating || 0);
  const [hoverStar, setHoverStar] = useState(0);

  // ── IntersectionObserver: track "view" when card is 60% visible ──────────
  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && !viewedRef.current) {
          viewedRef.current = true;
          postAction(outfit._id, 'view');
          observer.disconnect(); // only track once per mount
        }
      },
      { threshold: 0.6 } // 60% of card must be visible
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [outfit._id]);

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleLike = useCallback(() => {
    const newLiked = !liked;
    setLiked(newLiked);
    if (newLiked) setDisliked(false); // mutually exclusive
    postAction(outfit._id, newLiked ? 'like' : 'view'); // re-log view on unlike (neutral)
    if (newLiked) onAction?.('like');
  }, [liked, outfit._id, onAction]);

  const handleDislike = useCallback(() => {
    const newDisliked = !disliked;
    setDisliked(newDisliked);
    if (newDisliked) setLiked(false);
    postAction(outfit._id, newDisliked ? 'reject' : 'view');
    if (newDisliked) onAction?.('reject');
  }, [disliked, outfit._id, onAction]);

  const handleSave = useCallback(() => {
    const newSaved = !saved;
    setSaved(newSaved);
    if (newSaved) {
      postAction(outfit._id, 'save');
      onAction?.('save');
    }
  }, [saved, outfit._id, onAction]);

  const handleTryOn = useCallback(() => {
    postAction(outfit._id, 'try_on');
    onAction?.('try_on');
    router.push(`/tryon?outfitId=${outfit._id}&theme=${outfit.theme}`);
  }, [outfit._id, outfit.theme, router, onAction]);

  async function handleRate(r: number) {
    setRating(r);
    try {
      await API.put(`/api/outfits/${outfit._id}/rate`, { rating: r });
      onRatingChange?.(outfit._id, r);
    } catch (err) {
      console.error('Rating failed:', err);
    }
  }

  return (
    <div
      ref={cardRef}
      className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
    >
      {/* Image */}
      <div className="relative aspect-[3/4] overflow-hidden bg-gray-100 dark:bg-gray-800">
        {!imgError && outfit.imageUrl ? (
          <img
            src={outfit.imageUrl}
            alt={outfit.outfitName}
            className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
            <div className="flex gap-2">
              {outfit.colors.map((c, i) => (
                <div
                  key={i}
                  className="w-12 h-12 rounded-xl shadow border border-gray-200 dark:border-gray-700"
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <p className="text-xs text-gray-400 text-center leading-relaxed">{outfit.description}</p>
          </div>
        )}

        {/* Theme badge */}
        <div className="absolute top-3 left-3">
          <span className="text-[10px] font-bold uppercase tracking-widest bg-black/60 text-white px-2 py-1 rounded-lg backdrop-blur-sm">
            {outfit.theme}
          </span>
        </div>

        {/* Saved indicator */}
        {saved && (
          <div className="absolute top-3 right-3">
            <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-1 rounded-lg">
              Saved
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-base leading-tight">
            {outfit.outfitName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed line-clamp-2">
            {outfit.description}
          </p>
        </div>

        {/* Structured pieces (top + bottom) */}
        {(outfit.top || outfit.bottom) && (
          <div className="flex gap-2 text-xs">
            {outfit.top && (
              <span className="flex items-center gap-1 px-2 py-1 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-full border border-violet-200 dark:border-violet-800">
                ↑ {outfit.top}
              </span>
            )}
            {outfit.bottom && (
              <span className="flex items-center gap-1 px-2 py-1 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 rounded-full border border-indigo-200 dark:border-indigo-800">
                ↓ {outfit.bottom}
              </span>
            )}
          </div>
        )}

        {/* Palette */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Palette</p>
          <div className="flex gap-1.5">
            {outfit.colors.map((c, i) => (
              <div
                key={i}
                title={c}
                className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-800 shadow-sm"
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {/* Pieces */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Pieces</p>
          <div className="flex flex-wrap gap-1">
            {outfit.clothingPieces.slice(0, 3).map((p, i) => (
              <span
                key={i}
                className="text-[11px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full"
              >
                {p}
              </span>
            ))}
            {outfit.clothingPieces.length > 3 && (
              <span className="text-[11px] text-gray-400 px-2 py-0.5">
                +{outfit.clothingPieces.length - 3} more
              </span>
            )}
          </div>
        </div>

        {/* Star rating */}
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onMouseEnter={() => setHoverStar(star)}
              onMouseLeave={() => setHoverStar(0)}
              onClick={() => handleRate(star)}
              className="transition-transform hover:scale-110"
              aria-label={`Rate ${star} stars`}
            >
              <svg
                viewBox="0 0 20 20"
                className="w-4 h-4"
                fill={(hoverStar || rating) >= star ? '#F59E0B' : 'none'}
                stroke={(hoverStar || rating) >= star ? '#F59E0B' : '#D1D5DB'}
                strokeWidth="1.5"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </button>
          ))}
          {rating > 0 && (
            <span className="text-[11px] text-gray-400 ml-1">{rating}/5</span>
          )}
        </div>

        {/* ── Action Buttons ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-4 gap-2 mt-1">
          {/* Like */}
          <button
            onClick={handleLike}
            title="Like"
            aria-label="Like outfit"
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all duration-200 text-xs font-semibold
              ${liked
                ? 'bg-green-50 border-green-400 text-green-600 dark:bg-green-900/20 dark:border-green-500 dark:text-green-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-green-300 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/10'
              }`}
          >
            <ThumbsUp size={15} fill={liked ? 'currentColor' : 'none'} />
            <span>Like</span>
          </button>

          {/* Dislike */}
          <button
            onClick={handleDislike}
            title="Dislike"
            aria-label="Dislike outfit"
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all duration-200 text-xs font-semibold
              ${disliked
                ? 'bg-red-50 border-red-400 text-red-600 dark:bg-red-900/20 dark:border-red-500 dark:text-red-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-red-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10'
              }`}
          >
            <ThumbsDown size={15} fill={disliked ? 'currentColor' : 'none'} />
            <span>Dislike</span>
          </button>

          {/* Save */}
          <button
            onClick={handleSave}
            title="Save"
            aria-label="Save outfit"
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 transition-all duration-200 text-xs font-semibold
              ${saved
                ? 'bg-violet-50 border-violet-400 text-violet-600 dark:bg-violet-900/20 dark:border-violet-500 dark:text-violet-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/10'
              }`}
          >
            <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} />
            <span>Save</span>
          </button>

          {/* Try-On */}
          <button
            onClick={handleTryOn}
            title="Virtual Try-On"
            aria-label="Virtual try-on"
            className="flex flex-col items-center gap-1 py-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-500 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-900/10 transition-all duration-200 text-xs font-semibold"
          >
            <Shirt size={15} />
            <span>Try-On</span>
          </button>
        </div>
      </div>
    </div>
  );
}
