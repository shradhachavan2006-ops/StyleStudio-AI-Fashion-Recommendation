'use client';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Briefcase, Coffee, Music, Gem, PartyPopper, Star, GraduationCap, Monitor, Plane } from 'lucide-react';
import axios from '@/lib/api';

const THEMES = [
  { id: 'formal',      name: 'Formal',        icon: Briefcase,      color: 'bg-blue-500',   bg: 'bg-blue-50 dark:bg-blue-950/20',    usage: 'formal'  },
  { id: 'casual',      name: 'Casual',        icon: Coffee,         color: 'bg-green-500',  bg: 'bg-green-50 dark:bg-green-950/20',  usage: 'casual'  },
  { id: 'traditional', name: 'Traditional',   icon: Gem,            color: 'bg-red-500',    bg: 'bg-red-50 dark:bg-red-950/20',      usage: 'ethnic'  },
  { id: 'wedding',     name: 'Wedding',       icon: Star,           color: 'bg-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/20',  usage: 'formal'  },
  { id: 'party',       name: 'Party Night',   icon: PartyPopper,    color: 'bg-pink-500',   bg: 'bg-pink-50 dark:bg-pink-950/20',    usage: 'party'   },
  { id: 'event',       name: 'Special Event', icon: Music,          color: 'bg-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/20',usage: 'party'   },
  { id: 'college',     name: 'College',       icon: GraduationCap,  color: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/20',usage: 'casual'  },
  { id: 'office',      name: 'Office',        icon: Monitor,        color: 'bg-teal-500',   bg: 'bg-teal-50 dark:bg-teal-950/20',    usage: 'formal'  },
  { id: 'travel',      name: 'Travel',        icon: Plane,          color: 'bg-sky-500',    bg: 'bg-sky-50 dark:bg-sky-950/20',      usage: 'casual'  },
];

// ── Map body-profile skin-tone values → recommend API values ─────────────────
function mapSkinTone(raw: string): string {
  const m: Record<string, string> = {
    'very-fair': 'fair', 'fair': 'fair', 'light': 'fair',
    'medium': 'medium', 'olive': 'warm', 'tan': 'warm',
    'brown': 'dark', 'dark-brown': 'dark', 'deep': 'dark',
  };
  return m[raw] ?? raw;
}

// ── Map body-profile body-type values → recommend API bodyShape values ────────
function mapBodyShape(raw: string): string {
  const m: Record<string, string> = {
    'hourglass': 'hourglass', 'pear': 'pear', 'apple': 'apple',
    'rectangle': 'rectangle', 'inverted-triangle': 'inverted',
    'ectomorph': 'rectangle', 'mesomorph': 'inverted', 'endomorph': 'apple',
  };
  return m[raw] ?? raw;
}

// ── Map body-profile gender → recommend API gender ────────────────────────────
function mapGender(raw: string): string {
  const m: Record<string, string> = {
    'male': 'male', 'female': 'female',
    'non-binary': 'non-binary', 'prefer-not-to-say': 'female',
  };
  return m[raw] ?? raw;
}

export default function ThemesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  const handleSelectTheme = async (themeId: string) => {
    const theme = THEMES.find(t => t.id === themeId);
    if (!theme) return;

    setGeneratingFor(themeId);
    try {
      // 1️⃣ Generate AI outfit images (existing behaviour)
      await axios.post('/api/outfits/generate', { theme: themeId });

      // 2️⃣ Run ML recommendations using saved body profile + selected occasion
      const bc   = user?.bodyCharacteristics;
      const gender = user?.gender;

      if (bc?.skinTone && bc?.bodyType && gender) {
        try {
          const payload = {
            skinTone:  mapSkinTone(bc.skinTone),
            bodyShape: mapBodyShape(bc.bodyType),
            gender:    mapGender(gender),
            usage:     theme.usage,
          };
          const recRes = await axios.post('/api/recommend', payload);
          // Store in sessionStorage so OutfitsContent can display them
          sessionStorage.setItem('ss_recommendations', JSON.stringify(recRes.data));
          sessionStorage.setItem('ss_rec_theme', themeId);
        } catch {
          // ML step is non-blocking — outfits still load even if recommend fails
          sessionStorage.removeItem('ss_recommendations');
        }
      } else {
        // Profile incomplete — clear stale data
        sessionStorage.removeItem('ss_recommendations');
      }

      // 3️⃣ Go to outfits page
      router.push(`/outfits?theme=${themeId}`);
    } catch (err) {
      console.error('Failed to generate outfits', err);
      alert('Failed to generate outfits. Please try again.');
      setGeneratingFor(null);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-500 hover:text-black dark:hover:text-white transition-colors mb-8">
        <ArrowLeft size={20} /> Back to Dashboard
      </Link>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">Choose an Occasion</h1>
        <p className="text-gray-500 dark:text-gray-400 max-w-2xl mx-auto text-lg">
          Select a theme below. Our AI will instantly curate personalized outfits{user?.bodyCharacteristics?.skinTone ? ' using your saved body profile' : ''} tailored to the occasion.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {THEMES.map((theme) => {
          const Icon = theme.icon;
          const isGenerating = generatingFor === theme.id;

          return (
            <button
              key={theme.id}
              onClick={() => handleSelectTheme(theme.id)}
              disabled={generatingFor !== null}
              className={`text-left p-8 rounded-3xl border-2 transition-all ${theme.bg} ${generatingFor === null ? 'hover:scale-[1.02] hover:shadow-lg border-transparent' : 'opacity-50 cursor-not-allowed border-transparent'}`}
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white mb-6 ${theme.color}`}>
                <Icon size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">{theme.name}</h3>

              {isGenerating ? (
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300 mt-4 bg-white/50 dark:bg-black/20 p-3 rounded-lg inline-flex">
                  <div className="w-4 h-4 border-2 border-gray-400 border-t-black dark:border-t-white rounded-full animate-spin" />
                  AI is designing…
                </div>
              ) : (
                <div className="text-sm font-medium text-gray-500 mt-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Generate outfits <ArrowLeft size={14} className="rotate-180" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
