'use client';

import { useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import API from '@/lib/api';
import {
  SKIN_TONES,
  HAIR_COLORS,
  type AvatarUserProfile,
} from '@/components/Three/AvatarViewer';

// ── Dynamic import prevents SSR issues with Three.js ─────────────────────────
const AvatarViewer = dynamic(
  () => import('@/components/Three/AvatarViewer'),
  { ssr: false, loading: () => <AvatarLoadingScreen /> }
);

function AvatarLoadingScreen() {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Loading avatar…</p>
      </div>
    </div>
  );
}

// ── Color swatches ────────────────────────────────────────────────────────────
const CLOTHING_COLORS = [
  '#7C3AED', '#EC4899', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#ffffff', '#111827',
];
const BOTTOM_COLORS = [
  '#1a1a2e', '#111827', '#1E3A5F', '#374151',
  '#3B82F6', '#6B7280', '#4B2E6B', '#1C2B1A',
];

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AvatarPage() {
  const { user, updateUser, refreshUser } = useAuth();
  const router = useRouter();

  const [saving,    setSaving]    = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [gender,    setGender]    = useState<'female' | 'male'>(
    (user?.gender as 'female' | 'male') ?? 'female'
  );
  const [clothingColor,  setClothingColor]  = useState('#7C3AED');
  const [clothingColor2, setClothingColor2] = useState('#1a1a2e');

  // Build the profile object the viewer needs
  const profile = user?.bodyCharacteristics;
  const avatarProfile: AvatarUserProfile = {
    gender,
    skinTone:  profile?.skinTone  ?? 'medium',
    hairColor: profile?.hairColor ?? 'dark-brown',
    bodyType:  profile?.bodyType  ?? 'rectangle',
    height:    profile?.height    ?? 168,
    weight:    profile?.weight    ?? 65,
  };

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatusMsg('');
    try {
      const avatarConfig = JSON.stringify({
        source:         'local-glb',
        modelUrl:       gender === 'male' ? '/models/avatar_male.glb' : '/models/avatar_female.glb',
        gender,
        skinTone:       avatarProfile.skinTone,
        hairColor:      avatarProfile.hairColor,
        clothingColor,
        clothingColor2,
      });

      await API.put('/api/avatar', { avatarUrl: avatarConfig, gender });
      updateUser({ avatarUrl: avatarConfig, gender });
      await refreshUser();
      setStatusMsg('Saved! Taking you to outfits…');
      setTimeout(() => router.push('/themes'), 900);
    } catch {
      setStatusMsg('Save failed — please try again.');
      setSaving(false);
    }
  }, [gender, clothingColor, clothingColor2, avatarProfile, updateUser, refreshUser, router]);

  // ── Skin tone picker (use the canonical map) ──────────────────────────────
  const skinEntries = Object.entries(SKIN_TONES);
  const hairEntries = Object.entries(HAIR_COLORS);

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col text-white">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900 shrink-0">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Dashboard
        </button>
        <h1 className="text-sm font-bold">
          <span className="text-violet-400">StyleStudio</span>
          <span className="text-gray-600 mx-2">|</span>
          Avatar Customizer
        </h1>
        <div className="w-28" />
      </div>

      {/* ── Status toast ── */}
      {statusMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-full shadow-lg">
          {statusMsg}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="shrink-0 bg-gray-900 border-r border-gray-800 p-5 flex flex-col gap-5 overflow-y-auto"
          style={{ width: 276 }}
        >

          {/* Gender */}
          <Section label="Avatar gender">
            <div className="flex gap-2">
              {(['female', 'male'] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all
                    ${gender === g
                      ? 'border-violet-500 bg-violet-600 text-white'
                      : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
                >
                  {g === 'female' ? '👩 Female' : '👨 Male'}
                </button>
              ))}
            </div>
          </Section>

          {/* Body profile summary */}
          {profile && (
            <div className="bg-violet-900/30 border border-violet-700/40 rounded-2xl p-4">
              <p className="text-xs font-bold text-violet-300 uppercase tracking-wider mb-2">
                Your body profile
              </p>
              <div className="flex flex-wrap gap-1">
                {[
                  profile.bodyType  && `Body: ${profile.bodyType}`,
                  profile.skinTone  && `Skin: ${profile.skinTone}`,
                  profile.height    && `${profile.height} cm`,
                  profile.weight    && `${profile.weight} kg`,
                  profile.hairColor && `Hair: ${profile.hairColor}`,
                ].filter(Boolean).map((item, i) => (
                  <span key={i} className="text-xs bg-violet-800/50 text-violet-200 px-2 py-0.5 rounded-full">
                    {item}
                  </span>
                ))}
              </div>
              <p className="text-xs text-green-400 mt-2">✓ Applied to avatar automatically</p>
            </div>
          )}

          {/* Top clothing color */}
          <Section label="Top / clothing color">
            <SwatchRow
              swatches={CLOTHING_COLORS}
              value={clothingColor}
              onChange={setClothingColor}
            />
          </Section>

          {/* Bottom clothing color */}
          <Section label="Bottom / pants color">
            <SwatchRow
              swatches={BOTTOM_COLORS}
              value={clothingColor2}
              onChange={setClothingColor2}
            />
          </Section>

          {/* AI matching note */}
          <div className="bg-gradient-to-br from-violet-900/50 to-pink-900/30 border border-violet-700/30 rounded-2xl p-4">
            <p className="text-xs font-bold text-violet-300 mb-1">✦ AI Body Matching</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              Skin tone, hair colour, height and body shape from your profile are automatically applied to the 3D model.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-auto pt-2 flex flex-col gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold text-sm hover:opacity-90 disabled:opacity-60 transition-all shadow-lg"
            >
              {saving ? 'Saving…' : '✓ Save & browse outfits →'}
            </button>
            <button
              onClick={() => router.push('/themes')}
              className="w-full py-2 rounded-xl text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Skip — Browse outfits
            </button>
          </div>
        </aside>

        {/* ── 3D Viewport ── */}
        <div className="flex-1 relative bg-gradient-to-b from-gray-900 to-gray-950">
          <AvatarViewer
            user={avatarProfile}
            clothingColor={clothingColor}
            clothingColor2={clothingColor2}
            autoRotate={false}
            showControls
            showShadow
          />
        </div>
      </div>
    </div>
  );
}

// ── Tiny helper sub-components ────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
      {children}
    </div>
  );
}

function SwatchRow({
  swatches, value, onChange,
}: {
  swatches: string[];
  value: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {swatches.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          title={c}
          className={`w-8 h-8 rounded-full border-2 transition-all
            ${value === c ? 'border-violet-400 scale-110 shadow-lg shadow-violet-500/30' : 'border-gray-600 hover:border-gray-400'}`}
          style={{ backgroundColor: c }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-8 h-8 rounded-full border-2 border-gray-600 cursor-pointer bg-transparent"
        title="Custom colour"
      />
    </div>
  );
}
