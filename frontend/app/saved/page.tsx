'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, Trash2 } from 'lucide-react';
import axios from '@/lib/api';

interface SavedOutfit {
  _id: string;
  outfitId: string;
  snapshot: {
    outfitName?: string;
    description?: string;
    theme?: string;
    colors?: string[];
    clothingPieces?: string[];
    topImage?: string;
    bottomImage?: string;
    footwearImage?: string;
    accessoryImage?: string;
    imageUrl?: string;
  };
  createdAt: string;
}

export default function SavedPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    axios.get('/api/saved-outfits')
      .then((res) => setSavedOutfits(res.data.savedOutfits || []))
      .catch(console.error)
      .finally(() => setFetching(false));
  }, [user]);

  const removeSaved = async (outfitId: string) => {
    try {
      await axios.delete(`/api/saved-outfits/${outfitId}`);
      setSavedOutfits((prev) => prev.filter((item) => String(item.outfitId) !== String(outfitId)));
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors">
          <ArrowLeft size={20} /> Back to Dashboard
        </Link>
      </div>

      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2">Saved Outfits</h1>
        <p className="text-gray-500 dark:text-gray-400">
          {savedOutfits.length} outfit{savedOutfits.length !== 1 ? 's' : ''} saved
        </p>
      </div>

      {fetching ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-72 bg-gray-100 dark:bg-gray-800 rounded-3xl animate-pulse" />
          ))}
        </div>
      ) : savedOutfits.length === 0 ? (
        <div className="text-center py-24 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
          <Package size={56} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-bold mb-2">No saved outfits yet</h3>
          <p className="text-gray-500 mb-6">Save outfits from recommendations to see them here.</p>
          <Link href="/themes" className="px-6 py-3 bg-black text-white dark:bg-white dark:text-black rounded-xl font-bold">
            Generate Outfits
          </Link>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedOutfits.map((item) => {
            const outfit = item.snapshot || {};
            const image = outfit.topImage || outfit.imageUrl || outfit.bottomImage || outfit.footwearImage || outfit.accessoryImage || '';
            return (
              <div key={item._id} className="bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm hover:shadow-xl transition-shadow flex flex-col">
                <div className="aspect-[4/3] bg-gray-50 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
                  {image ? (
                    <img src={image} alt={outfit.outfitName || 'Saved outfit'} className="w-full h-full object-contain" />
                  ) : (
                    <div className="flex gap-2">
                      {(outfit.colors || ['#8B5CF6', '#EC4899', '#111827']).slice(0, 4).map((color, i) => (
                        <div key={i} className="w-12 h-12 rounded-xl border border-white/20" style={{ backgroundColor: color }} />
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <h3 className="font-bold text-lg leading-tight">{outfit.outfitName || 'Saved Outfit'}</h3>
                      {outfit.theme && (
                        <p className="text-xs text-violet-500 font-semibold capitalize mt-1">{outfit.theme}</p>
                      )}
                    </div>
                    <button
                      onClick={() => removeSaved(item.outfitId)}
                      title="Remove saved outfit"
                      className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-red-500 hover:border-red-200 transition-colors"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">
                    {outfit.description || 'No description available.'}
                  </p>

                  {(outfit.clothingPieces || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {(outfit.clothingPieces || []).slice(0, 4).map((piece, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-xs rounded-md">
                          {piece}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-400 mt-auto">
                    Saved {new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
