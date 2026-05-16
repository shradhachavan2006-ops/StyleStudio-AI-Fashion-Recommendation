'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ArrowRight, Sparkles, Wand2, Brain } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();

  return (
    <div className="flex flex-col min-h-[calc(100vh-73px)]">

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-20
                          bg-gradient-to-b from-white to-violet-50
                          dark:from-gray-950 dark:to-gray-900
                          border-b border-gray-100 dark:border-gray-800 relative overflow-hidden">
        {/* Background orbs */}
        <div className="absolute top-0 left-1/3 w-96 h-96 bg-violet-400/10 dark:bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-pink-400/10 dark:bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                          bg-violet-100 dark:bg-violet-900/30
                          text-violet-600 dark:text-violet-300 font-medium mb-8 text-sm">
            <Sparkles size={14} />
            <span>Explainable AI · Hybrid Recommendations</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6
                         bg-clip-text text-transparent
                         bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500">
            Your Personal Style Engine
          </h1>

          <p className="text-xl md:text-2xl text-gray-500 dark:text-gray-400 mb-10
                        max-w-2xl mx-auto leading-relaxed">
            Tell us your body type, skin tone and occasion — our hybrid ML + rule-based AI
            curates your perfect outfits and{' '}
            <span className="text-violet-500 font-semibold">explains every choice</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {loading ? (
              <div className="h-14 w-48 bg-gray-200 dark:bg-gray-800 rounded-xl animate-pulse" />
            ) : user ? (
              <>
                <Link
                  href="/body-profile"
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-600 to-pink-600
                             text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity
                             shadow-lg shadow-violet-500/30 flex items-center justify-center gap-2"
                >
                  <Sparkles size={20} /> Get Recommendations
                </Link>
                <Link
                  href="/themes"
                  className="w-full sm:w-auto px-8 py-4 bg-white text-black
                             dark:bg-gray-900 dark:text-white
                             border-2 border-gray-200 dark:border-gray-800 rounded-xl font-bold text-lg
                             hover:border-violet-300 dark:hover:border-violet-700 transition-colors
                             flex items-center justify-center gap-2"
                >
                  Choose Occasion →
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/register"
                  className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-violet-500 to-pink-500
                             text-white rounded-xl font-bold text-lg hover:opacity-90 transition-opacity
                             shadow-lg shadow-violet-500/25 flex items-center justify-center gap-2"
                >
                  Get Started Free
                </Link>
                <Link
                  href="/login"
                  className="w-full sm:w-auto px-8 py-4 bg-white text-black
                             dark:bg-gray-900 dark:text-white
                             border-2 border-gray-200 dark:border-gray-800 rounded-xl font-bold text-lg
                             hover:border-violet-300 dark:hover:border-violet-700 transition-colors
                             flex items-center justify-center"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <section className="py-24 px-6 bg-white dark:bg-gray-950">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold">How StyleStudio Works</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-3 max-w-xl mx-auto">
              Three simple steps to outfit recommendations that actually make sense.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="p-8 rounded-3xl bg-gray-50 dark:bg-gray-900
                            border border-gray-100 dark:border-gray-800
                            hover:border-violet-200 dark:hover:border-violet-800
                            transition-colors group">
              <div className="w-14 h-14 bg-blue-100 text-blue-600
                              dark:bg-blue-900/50 dark:text-blue-400
                              rounded-2xl flex items-center justify-center mb-6
                              group-hover:scale-110 transition-transform">
                <Wand2 size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">1. Build Your Profile</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Enter your skin tone, body shape, hair, and style preferences once.
                Our system uses this to calibrate the ML model and style rule engine.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-8 rounded-3xl bg-gray-50 dark:bg-gray-900
                            border border-gray-100 dark:border-gray-800
                            hover:border-violet-200 dark:hover:border-violet-800
                            transition-colors group">
              <div className="w-14 h-14 bg-violet-100 text-violet-600
                              dark:bg-violet-900/50 dark:text-violet-400
                              rounded-2xl flex items-center justify-center mb-6
                              group-hover:scale-110 transition-transform">
                <Brain size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">2. Pick an Occasion</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Choose from Formal, Casual, Party, Wedding and more. Our AI
                immediately generates outfits <em>and</em> ML-scored style picks for that occasion.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-8 rounded-3xl bg-gray-50 dark:bg-gray-900
                            border border-gray-100 dark:border-gray-800
                            hover:border-violet-200 dark:hover:border-violet-800
                            transition-colors group">
              <div className="w-14 h-14 bg-pink-100 text-pink-600
                              dark:bg-pink-900/50 dark:text-pink-400
                              rounded-2xl flex items-center justify-center mb-6
                              group-hover:scale-110 transition-transform">
                <Sparkles size={28} />
              </div>
              <h3 className="text-xl font-bold mb-3">3. Explained Results</h3>
              <p className="text-gray-500 dark:text-gray-400 leading-relaxed">
                Every recommendation comes with a plain-English reason —{' '}
                <em>&quot;suits your warm skin tone, ideal for casual occasions and balances your body proportions.&quot;</em>
              </p>
            </div>
          </div>

          {/* CTA for logged-out users */}
          {!loading && !user && (
            <div className="mt-16 text-center">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4
                           bg-gradient-to-r from-violet-600 to-pink-600 text-white
                           rounded-xl font-bold text-lg hover:opacity-90 transition-opacity
                           shadow-lg shadow-violet-500/25"
              >
                Start for free <ArrowRight size={20} />
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* ── Tech Stack Badge ─────────────────────────────────────────────── */}
      <section className="py-10 px-6 bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-4">Powered by</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Random Forest ML', 'Rule Engine', 'Explainable AI', 'Node.js + Express', 'MongoDB', 'Next.js'].map(t => (
              <span key={t} className="px-3 py-1.5 rounded-full bg-white dark:bg-gray-800
                                       border border-gray-200 dark:border-gray-700
                                       text-xs font-semibold text-gray-600 dark:text-gray-300">
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}