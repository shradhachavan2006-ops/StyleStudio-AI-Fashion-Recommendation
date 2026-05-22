'use client';

import { useAuth } from '@/context/AuthContext';
import axios from '@/lib/api';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bookmark,
  ClipboardList,
  Clock,
  MapPin,
  Palette,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
} from 'lucide-react';

type DashboardStats = {
  recommendations: number;
  savedOutfits: number;
  likes: number;
  dislikes: number;
  recent: Array<{ id: string; action: string; outfitName: string; theme: string; timestamp: string }>;
};

const EMPTY_STATS: DashboardStats = {
  recommendations: 0,
  savedOutfits: 0,
  likes: 0,
  dislikes: 0,
  recent: [],
};

export default function Dashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [greeting, setGreeting] = useState('');
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);

  useEffect(() => {
    if (!loading && !user) router.push('/login');

    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const loadStats = async () => {
      try {
        const res = await axios.get('/api/actions/summary');
        if (!cancelled) setStats({ ...EMPTY_STATS, ...res.data });
      } catch {
        if (!cancelled) setStats(EMPTY_STATS);
      }
    };

    loadStats();
    window.addEventListener('focus', loadStats);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', loadStats);
    };
  }, [user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="loading-spinner w-12 h-12" />
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
      color: 'from-blue-500 to-cyan-500',
      bg: 'bg-blue-50 dark:bg-blue-950/20',
    },
    {
      step: '2',
      href: '/themes',
      icon: Palette,
      label: 'Pick a Theme',
      desc: 'Choose an occasion and let AI generate outfits.',
      done: false,
      color: 'from-violet-500 to-purple-500',
      bg: 'bg-violet-50 dark:bg-violet-950/20',
    },
    {
      step: '3',
      href: '/stores',
      icon: MapPin,
      label: 'Visit Stores',
      desc: 'Find nearby fashion stores for your recommended looks.',
      done: false,
      color: 'from-emerald-500 to-teal-500',
      bg: 'bg-emerald-50 dark:bg-emerald-950/20',
    },
    {
      step: '4',
      href: '/saved',
      icon: Bookmark,
      label: 'Saved Outfits',
      desc: 'View your saved recommendation picks.',
      done: stats.savedOutfits > 0,
      color: 'from-orange-500 to-red-500',
      bg: 'bg-orange-50 dark:bg-orange-950/20',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-12 animate-slide-up">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">{user.name?.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h1 className="text-4xl font-bold">
                {greeting}, <span className="gradient-text">{user.name}</span>
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                {hasProfile
                  ? 'Your profile is set. Ready to discover your perfect style?'
                  : 'Complete your profile to get the most accurate AI recommendations.'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-12 animate-slide-in-left">
          <StatCard
            icon={TrendingUp}
            label="Recommendations"
            value={stats.recommendations}
            detail="Generated for your account"
            className="from-violet-500 to-purple-600"
          />
          <StatCard
            icon={Bookmark}
            label="Saved Outfits"
            value={stats.savedOutfits}
            detail="Only your saved picks"
            className="from-pink-500 to-rose-600"
          />
          <StatCard
            icon={ThumbsUp}
            label="Likes"
            value={stats.likes}
            detail="Your positive signals"
            className="from-emerald-500 to-teal-600"
          />
          <StatCard
            icon={ThumbsDown}
            label="Dislikes"
            value={stats.dislikes}
            detail="Used to improve results"
            className="from-slate-600 to-gray-700"
          />
        </div>

        <h2 className="text-2xl font-bold mb-6">Your Style Journey</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {steps.map((s, idx) => (
            <Link key={s.label} href={s.href} className="group animate-slide-in-left" style={{ animationDelay: `${idx * 0.1}s` }}>
              <div className={`relative p-6 rounded-2xl border-2 transition-all duration-300 card-hover ${
                s.done
                  ? 'bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border-green-200 dark:border-green-900'
                  : `${s.bg} border-gray-100 dark:border-gray-800`
              }`}>
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-4 shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                  <s.icon size={24} className="text-white" />
                </div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-lg">{s.step}. {s.label}</h3>
                  {s.done && (
                    <span className="text-xs font-semibold text-green-600 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-2 py-1 rounded-full">
                      Done
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
                {!s.done && (
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Sparkles size={16} className="text-violet-500" />
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {!hasProfile && (
          <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border border-amber-200 dark:border-amber-900 rounded-2xl p-6 animate-slide-up">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                <Sparkles size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-amber-800 dark:text-amber-300">Complete your Body Profile first</h3>
                <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                  The AI uses your skin tone, body shape, hair, and eye colour to suggest outfits that suit you perfectly.
                </p>
                <Link href="/body-profile" className="inline-flex items-center gap-2 mt-3 text-sm font-bold text-amber-700 dark:text-amber-300 hover:gap-3 transition-all">
                  Fill in my profile <Sparkles size={14} />
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 p-8 text-white shadow-2xl animate-slide-up">
          <div className="relative flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Ready to discover your style?</h2>
              <p className="opacity-90 max-w-lg text-sm">
                Complete your body profile to get accurate recommendations, then explore themes to generate outfits.
              </p>
            </div>
            <Link
              href={hasProfile ? '/themes' : '/body-profile'}
              className="group shrink-0 bg-white text-gray-900 px-6 py-3 rounded-xl font-bold hover:shadow-xl transition-all duration-300 hover:scale-105 flex items-center gap-2"
            >
              {hasProfile ? 'Generate outfits' : 'Start profile'}
              <Sparkles size={18} className="group-hover:rotate-12 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Clock size={24} className="text-violet-500" />
            Recent Activity
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-6">
            <div className="space-y-4">
              {stats.recent.map((activity, idx) => (
                <div key={activity.id || idx} className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <div className="text-2xl">{activity.action === 'save' ? '★' : activity.action === 'like' ? '+' : activity.action === 'reject' ? '-' : '•'}</div>
                  <div className="flex-1">
                    <p className="font-medium capitalize">{activity.action} · {activity.outfitName}</p>
                    <p className="text-xs text-gray-400">{new Date(activity.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {stats.recent.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No interactions yet. Like, dislike, or save outfits to start personalizing your dashboard.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  className,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: number;
  detail: string;
  className: string;
}) {
  return (
    <div className={`bg-gradient-to-br ${className} rounded-2xl p-5 text-white shadow-lg`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-90">{label}</p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon size={32} className="opacity-80" />
      </div>
      <p className="text-xs opacity-80 mt-2">{detail}</p>
    </div>
  );
}
