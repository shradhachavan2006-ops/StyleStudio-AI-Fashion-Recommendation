/* frontend/app/page.tsx - Enhanced with animations */
'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Sparkles, Wand2, Brain, Shield, Zap, Heart } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-[calc(100vh-73px)]">
      {/* Hero Section with animated background */}
      <section className="relative flex-1 flex flex-col items-center justify-center px-6 py-20 overflow-hidden">
        {/* Animated gradient background */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950" />
        
        {/* Animated orbs */}
        <div className="pointer-events-none absolute top-20 left-10 w-72 h-72 bg-violet-400/20 rounded-full blur-3xl animate-float" />
        <div className="pointer-events-none absolute bottom-20 right-10 w-96 h-96 bg-pink-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-400/10 rounded-full blur-3xl animate-pulse-glow" />

        <div className="max-w-5xl mx-auto text-center relative z-10 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-violet-100 to-pink-100 dark:from-violet-900/30 dark:to-pink-900/30 text-violet-600 dark:text-violet-300 font-medium mb-8 text-sm shadow-lg">
            <Sparkles size={14} className="animate-pulse" />
            <span>AI-Powered · Explainable · Hybrid Recommendations</span>
          </div>

          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6">
            <span className="gradient-text">Your Personal</span>
            <br />
            <span className="gradient-text">Style Engine</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Tell us your body type, skin tone and occasion — our hybrid ML + rule-based AI
            curates your perfect outfits and{' '}
            <span className="text-violet-500 font-semibold">explains every choice</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {loading ? (
              <div className="h-14 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            ) : user ? (
              <Link href="/body-profile" className="btn-primary inline-flex items-center gap-2 group">
                <Sparkles size={20} className="group-hover:rotate-12 transition-transform" />
                Get Started
              </Link>
            ) : (
              <>
                <Link href="/register" className="btn-primary inline-flex items-center gap-2 group">
                  Get Started Free
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link href="/login" className="btn-secondary">
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Floating elements */}
        <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-4 text-gray-400 text-xs">
          <Shield size={14} />
          <span>Privacy First</span>
          <Zap size={14} />
          <span>Real-time AI</span>
          <Heart size={14} />
          <span>Personalized</span>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-white dark:bg-gray-950 relative">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-5" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-16 animate-slide-up">
            <span className="text-sm font-semibold text-violet-500 uppercase tracking-wider">Process</span>
            <h2 className="text-4xl md:text-5xl font-bold mt-2 mb-4">How StyleStudio Works</h2>
            <p className="text-gray-500 dark:text-gray-400 text-lg max-w-2xl mx-auto">
              Three simple steps to outfit recommendations that actually make sense.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Wand2,
                title: 'Build Your Profile',
                desc: 'Enter your skin tone, body shape, hair, and style preferences once. Our system calibrates the ML model and style rule engine for you.',
                color: 'from-blue-500 to-cyan-500',
                bg: 'bg-blue-50 dark:bg-blue-950/20',
                delay: 0
              },
              {
                icon: Brain,
                title: 'Pick an Occasion',
                desc: 'Choose from Formal, Casual, Party, Wedding and more. Our AI generates outfits and ML-scored style picks for that occasion.',
                color: 'from-violet-500 to-purple-500',
                bg: 'bg-violet-50 dark:bg-violet-950/20',
                delay: 0.1
              },
              {
                icon: Sparkles,
                title: 'Explained Results',
                desc: 'Every recommendation comes with a plain-English reason — "suits your warm skin tone, ideal for casual occasions".',
                color: 'from-pink-500 to-rose-500',
                bg: 'bg-pink-50 dark:bg-pink-950/20',
                delay: 0.2
              }
            ].map((step, idx) => (
              <div 
                key={idx}
                className={`group relative p-8 rounded-3xl ${step.bg} border border-gray-100 dark:border-gray-800 card-hover animate-slide-in-left`}
                style={{ animationDelay: `${step.delay}s` }}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-5 rounded-3xl transition-opacity duration-500`} />
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-6 shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
                  <step.icon size={32} className="text-white" />
                </div>
                <h3 className="text-2xl font-bold mb-3">{idx + 1}. {step.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>

          {!loading && !user && (
            <div className="mt-16 text-center animate-slide-up">
              <Link href="/register" className="btn-primary inline-flex items-center gap-2 group">
                Start for free
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why Choose StyleStudio?</h2>
            <p className="text-gray-500 dark:text-gray-400">Experience fashion like never before</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              { icon: Sparkles, title: 'AI-Powered', desc: 'Smart recommendations that learn your style' },
              { icon: Brain, title: 'Explainable', desc: 'Understand why each outfit works for you' },
              { icon: Zap, title: 'Real-time', desc: 'Instant outfit generation for any occasion' },
              { icon: Heart, title: 'Personalized', desc: 'Tailored to your unique body and preferences' }
            ].map((feature, idx) => (
              <div key={idx} className="text-center p-6 rounded-2xl hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 card-hover">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center mx-auto mb-4">
                  <feature.icon size={20} className="text-white" />
                </div>
                  <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{feature.desc}</p>
                </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 px-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-4">Powered by cutting-edge technology</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Random Forest ML', 'Rule Engine', 'Explainable AI', 'Node.js + Express', 'MongoDB', 'Next.js 14', 'Tailwind CSS', 'TypeScript'].map(t => (
              <span key={t} className="px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:border-violet-300 transition-all duration-300">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
