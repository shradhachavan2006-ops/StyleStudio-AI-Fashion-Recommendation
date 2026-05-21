'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Palette, Bookmark, ClipboardList, MapPin } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-4 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  const hasProfile = !!user.bodyCharacteristics?.skinTone;
  const steps = [
    {
      step: '1',
      href: '/body-profile',
      icon: ClipboardList,
      label: 'Body Profile',
      desc: hasProfile ? 'Profile saved. Click to update it.' : 'Tell us about your appearance for personalized fits.',
      done: hasProfile,
      accent: 'blue',
    },
    {
      step: '2',
      href: '/themes',
      icon: Palette,
      label: 'Pick a Theme',
      desc: 'Choose an occasion and let AI generate outfits.',
      done: false,
      accent: 'pink',
    },
    {
      step: '3',
      href: '/stores',
      icon: MapPin,
      label: 'Visit Stores',
      desc: 'Find nearby fashion stores for your recommended looks.',
      done: false,
      accent: 'emerald',
    },
    {
      step: '4',
      href: '/saved',
      icon: Bookmark,
      label: 'Saved Outfits',
      desc: 'View your saved recommendation picks.',
      done: false,
      accent: 'orange',
    },
  ];

  const accentMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400 group-hover:border-blue-300',
    pink: 'bg-pink-100 text-pink-600 dark:bg-pink-900/50 dark:text-pink-400 group-hover:border-pink-300',
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400 group-hover:border-emerald-300',
    orange: 'bg-orange-100 text-orange-600 dark:bg-orange-900/50 dark:text-orange-400 group-hover:border-orange-300',
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold">Welcome back, {user.name}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {hasProfile
            ? 'Your profile is set. Pick a theme and generate outfits.'
            : 'Complete your profile to get the most accurate AI recommendations.'}
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
        {steps.map((s) => (
          <Link key={s.label} href={s.href} className="group">
            <div
              className={`p-6 rounded-3xl border-2 transition-all h-full ${
                s.done
                  ? 'bg-green-50/50 border-green-200 dark:bg-green-950/20 dark:border-green-900/50'
                  : 'bg-white border-gray-100 dark:bg-gray-900 dark:border-gray-800'
              }`}
            >
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${
                  s.done
                    ? 'bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400'
                    : accentMap[s.accent]
                }`}
              >
                <s.icon size={22} />
              </div>

              <div className="flex items-start justify-between mb-2">
                <h3 className="font-bold text-lg leading-tight">
                  {s.step}. {s.label}
                </h3>
                {s.done && (
                  <span className="text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full ml-2 shrink-0">
                    Done
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400 leading-snug">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {!hasProfile && (
        <div className="mb-8 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-2xl p-5 flex items-start gap-4">
          <Sparkles className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Complete your Body Profile first</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
              The AI uses your skin tone, body shape, hair, and eye colour to suggest outfits that suit you.
            </p>
            <Link href="/body-profile" className="inline-block mt-3 text-xs font-bold text-amber-700 dark:text-amber-300 underline underline-offset-2">
              Fill in my profile
            </Link>
          </div>
        </div>
      )}

      <div className="bg-gradient-to-br from-violet-500 to-pink-500 rounded-3xl p-8 text-white flex flex-col sm:flex-row gap-6 items-start sm:items-center">
        <div className="flex-1">
          <h2 className="text-2xl font-bold mb-1">Ready to design?</h2>
          <p className="opacity-90 max-w-lg text-sm">
            Complete your body profile to get accurate recommendations, then jump into the theme picker to generate outfits.
          </p>
        </div>
        <Link
          href={hasProfile ? '/themes' : '/body-profile'}
          className="shrink-0 bg-white text-black px-6 py-3 rounded-xl font-bold hover:scale-105 transition-transform text-sm"
        >
          {hasProfile ? 'Generate outfits' : 'Start profile'}
        </Link>
      </div>
    </div>
  );
}
