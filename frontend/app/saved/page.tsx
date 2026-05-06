'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Heart, Star, Trash2, Share2, Package } from 'lucide-react';
import axios from '@/lib/api';

interface SavedDesign {
  _id: string;
  avatarUrl: string;
  outfitData: {
    outfitName: string;
    description: string;
    theme: string;
    colors: string[];
    clothingPieces: string[];
  };
  theme: string;
  isFavorite: boolean;
  rating: number;
  shareToken: string;
  createdAt: string;
}

function StarRating({ value, onRate }: { value: number; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(star)}
          className={`transition-colors ${star <= (hover || value) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
        >
          <Star size={16} fill={star <= (hover || value) ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}

export default function SavedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [designs, setDesigns] = useState<SavedDesign[]>([]);
  const [fetching, setFetching] = useState(true);
  const [showFavOnly, setShowFavOnly] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    axios.get('/api/saved-designs')
      .then((res) => setDesigns(res.data.designs))
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [user]);

  const toggleFavorite = async (id: string) => {
    try {
      const res = await axios.put(`/api/saved-designs/${id}/favorite`);
      setDesigns((prev) =>
        prev.map((d) => (d._id === id ? res.data.design : d))
      );
    } catch (err) { console.error(err); }
  };

  const rateDesign = async (id: string, rating: number) => {
    try {
      const res = await axios.put(`/api/saved-designs/${id}/rate`, { rating });
      setDesigns((prev) =>
        prev.map((d) => (d._id === id ? res.data.design : d))
      );
    } catch (err) { console.error(err); }
  };

  const deleteDesign = async (id: string) => {
    if (!confirm('Remove this saved design?')) return;
    try {
      await axios.delete(`/api/saved-designs/${id}`);
      setDesigns((prev) => prev.filter((d) => d._id !== id));
    } catch (err) { console.error(err); }
  };

  const shareDesign = (token: string) => {
    const url = `${window.location.origin}/api/saved-designs/share/${token}`;
    navigator.clipboard.writeText(url).then(() => alert('Share link copied to clipboard!'));
  };

  const displayed = showFavOnly ? designs.filter((d) => d.isFavorite) : designs;

  if (loading || !user) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
      </div>

      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold mb-2">Saved Designs</h1>
          <p className="text-gray-500 dark:text-gray-400">{designs.length} outfit{designs.length !== 1 ? 's' : ''} saved</p>
        </div>
        <button
          onClick={() => setShowFavOnly(!showFavOnly)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm border-2 transition-colors ${showFavOnly ? 'bg-pink-50 border-pink-300 text-pink-600 dark:bg-pink-950/30 dark:border-pink-800' : 'border-gray-200 dark:border-gray-700 hover:border-pink-200'}`}
        >
          <Heart size={16} fill={showFavOnly ? 'currentColor' : 'none'} />
          Favorites Only
        </button>
      </div>

      {fetching ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="h-72 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
          <Package size={56} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold mb-2">{showFavOnly ? 'No favorites yet' : 'No saved designs yet'}</h3>
          <p className="text-gray-500 mb-6">
            {showFavOnly ? 'Heart an outfit to add it here.' : 'Try on outfits and save your favourite looks!'}
          </p>
          {!showFavOnly && (
            <Link href="/themes" className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold">
              Generate Outfits
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayed.map((design) => (
            <div key={design._id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl transition-shadow flex flex-col">
              {/* Colour stripe header */}
              <div className="h-32 flex relative overflow-hidden">
                {design.outfitData.colors?.length > 0 ? (
                  design.outfitData.colors.map((c, i) => (
                    <div key={i} className="flex-1 h-full" style={{ backgroundColor: c }} />
                  ))
                ) : (
                  <div className="flex-1 bg-gradient-to-br from-purple-500 to-pink-500" />
                )}
                {/* Theme badge */}
                <div className="absolute bottom-3 left-4">
                  <span className="px-3 py-1 bg-black/50 backdrop-blur-sm text-white text-xs rounded-full capitalize">
                    {design.outfitData.theme || design.theme}
                  </span>
                </div>
              </div>

              <div className="p-6 flex-1 flex flex-col">
                <h3 className="font-bold text-lg mb-1">{design.outfitData.outfitName}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                  {design.outfitData.description}
                </p>

                {/* Clothing pieces */}
                {design.outfitData.clothingPieces?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-4">
                    {design.outfitData.clothingPieces.slice(0, 3).map((p, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-xs rounded-md">
                        {p}
                      </span>
                    ))}
                    {design.outfitData.clothingPieces.length > 3 && (
                      <span className="text-xs text-gray-400 self-center">
                        +{design.outfitData.clothingPieces.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Rating */}
                <div className="mb-4">
                  <StarRating value={design.rating} onRate={(r) => rateDesign(design._id, r)} />
                </div>

                <p className="text-xs text-gray-400 mb-4">
                  Saved {new Date(design.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>

                {/* Actions */}
                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => toggleFavorite(design._id)}
                    title={design.isFavorite ? 'Unfavourite' : 'Favourite'}
                    className={`p-2.5 rounded-xl border transition-colors ${design.isFavorite ? 'bg-pink-50 border-pink-200 text-pink-500 dark:bg-pink-950/30 dark:border-pink-900' : 'border-gray-200 dark:border-gray-700 text-gray-500 hover:text-pink-500 hover:border-pink-200'}`}
                  >
                    <Heart size={18} fill={design.isFavorite ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => shareDesign(design.shareToken)}
                    title="Copy share link"
                    className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-blue-500 hover:border-blue-200 transition-colors"
                  >
                    <Share2 size={18} />
                  </button>
                  <Link
                    href={`/tryon?outfitId=${design._id}`}
                    className="flex-1 text-center py-2 bg-black text-white dark:bg-white dark:text-black rounded-xl text-sm font-bold hover:opacity-90 transition-opacity"
                  >
                    View 3D
                  </Link>
                  <button
                    onClick={() => deleteDesign(design._id)}
                    title="Delete"
                    className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
