'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ─── SVG Body Shape Silhouettes ───────────────────────────────────────────────

const BodyShapeSVGs: Record<string, React.ReactElement> = {
    hourglass: (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="7" ry="7.5" fill="currentColor" opacity="0.9" />
            <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M8 23 Q30 19 52 23 L49 36 Q30 31 11 36 Z" fill="currentColor" opacity="0.9" />
            <path d="M11 36 Q30 42 49 36 L47 52 Q30 48 13 52 Z" fill="currentColor" opacity="0.85" />
            <path d="M13 52 Q30 48 47 52 L45 65 Q30 62 15 65 Z" fill="currentColor" opacity="0.9" />
            <path d="M15 65 L19 98 L25 98 L30 73 L35 98 L41 98 L45 65 Q30 62 15 65Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
    pear: (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="6.5" ry="7" fill="currentColor" opacity="0.9" />
            <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M15 23 Q30 19 45 23 L43 36 Q30 33 17 36 Z" fill="currentColor" opacity="0.9" />
            <path d="M17 36 Q30 39 43 36 L44 51 Q30 47 16 51 Z" fill="currentColor" opacity="0.85" />
            <path d="M16 51 Q30 47 44 51 L47 65 Q30 62 13 65 Z" fill="currentColor" opacity="0.9" />
            <path d="M13 65 L17 98 L24 98 L30 74 L36 98 L43 98 L47 65 Q30 62 13 65Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
    apple: (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="7" ry="7.5" fill="currentColor" opacity="0.9" />
            <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M10 23 Q30 18 50 23 L50 36 Q30 30 10 36 Z" fill="currentColor" opacity="0.9" />
            <path d="M10 36 Q30 30 50 36 L52 55 Q30 52 8 55 Z" fill="currentColor" opacity="0.9" />
            <path d="M8 55 Q30 52 52 55 L48 65 Q30 63 12 65 Z" fill="currentColor" opacity="0.85" />
            <path d="M12 65 L17 98 L24 98 L30 74 L36 98 L43 98 L48 65 Q30 63 12 65Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
    rectangle: (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="6.5" ry="7" fill="currentColor" opacity="0.9" />
            <rect x="27" y="15" width="6" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M13 23 Q30 21 47 23 L46 36 Q30 34 14 36 Z" fill="currentColor" opacity="0.9" />
            <path d="M14 36 Q30 34 46 36 L45 52 Q30 50 15 52 Z" fill="currentColor" opacity="0.85" />
            <path d="M15 52 Q30 50 45 52 L44 65 Q30 63 16 65 Z" fill="currentColor" opacity="0.9" />
            <path d="M16 65 L20 98 L26 98 L30 75 L34 98 L40 98 L44 65 Q30 63 16 65Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
    'inverted-triangle': (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="7.5" ry="8" fill="currentColor" opacity="0.9" />
            <rect x="27" y="16" width="6" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M6 23 Q30 17 54 23 L50 36 Q30 31 10 36 Z" fill="currentColor" opacity="0.9" />
            <path d="M10 36 Q30 31 50 36 L46 52 Q30 49 14 52 Z" fill="currentColor" opacity="0.85" />
            <path d="M14 52 Q30 49 46 52 L42 65 Q30 63 18 65 Z" fill="currentColor" opacity="0.9" />
            <path d="M18 65 L21 98 L27 98 L30 75 L33 98 L39 98 L42 65 Q30 63 18 65Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
    ectomorph: (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="6" ry="6.5" fill="currentColor" opacity="0.9" />
            <rect x="27.5" y="14.5" width="5" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M18 23 Q30 21 42 23 L41 36 Q30 34 19 36 Z" fill="currentColor" opacity="0.9" />
            <path d="M19 36 Q30 34 41 36 L40 52 Q30 50 20 52 Z" fill="currentColor" opacity="0.85" />
            <path d="M20 52 Q30 50 40 52 L39 65 Q30 63 21 65 Z" fill="currentColor" opacity="0.9" />
            <path d="M21 65 L24 98 L28 98 L30 76 L32 98 L36 98 L39 65 Q30 63 21 65Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
    mesomorph: (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="7.5" ry="8" fill="currentColor" opacity="0.9" />
            <rect x="27" y="16" width="6" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M7 23 Q30 16 53 23 L50 34 Q30 27 10 34 Z" fill="currentColor" opacity="0.9" />
            <path d="M10 34 Q30 39 50 34 L48 50 Q30 46 12 50 Z" fill="currentColor" opacity="0.85" />
            <path d="M12 50 Q30 46 48 50 L45 64 Q30 61 15 64 Z" fill="currentColor" opacity="0.9" />
            <path d="M15 64 L19 98 L26 98 L30 73 L34 98 L41 98 L45 64 Q30 61 15 64Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
    endomorph: (
        <svg viewBox="0 0 60 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-12 h-20">
            <ellipse cx="30" cy="8" rx="8.5" ry="8.5" fill="currentColor" opacity="0.9" />
            <rect x="26" y="16.5" width="8" height="5" rx="2" fill="currentColor" opacity="0.75" />
            <path d="M7 23 Q30 17 53 23 L54 37 Q30 31 6 37 Z" fill="currentColor" opacity="0.9" />
            <path d="M6 37 Q30 31 54 37 L56 55 Q30 51 4 55 Z" fill="currentColor" opacity="0.9" />
            <path d="M4 55 Q30 51 56 55 L52 66 Q30 63 8 66 Z" fill="currentColor" opacity="0.85" />
            <path d="M8 66 L13 98 L22 98 L30 74 L38 98 L47 98 L52 66 Q30 63 8 66Z" fill="currentColor" opacity="0.82" />
        </svg>
    ),
};

// ─── Hair texture SVG icons ───────────────────────────────────────────────────

const HairTextureSVGs: Record<string, React.ReactElement> = {
    straight: (
        <svg viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-6">
            <line x1="4" y1="8" x2="40" y2="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="4" y1="15" x2="40" y2="15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="4" y1="22" x2="40" y2="22" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
    ),
    wavy: (
        <svg viewBox="0 0 44 30" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-6">
            <path d="M4 8  Q10 3  16 8  Q22 13 28 8  Q34 3  40 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M4 17 Q10 12 16 17 Q22 22 28 17 Q34 12 40 17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
            <path d="M4 26 Q10 21 16 26 Q22 31 28 26 Q34 21 40 26" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </svg>
    ),
    curly: (
        // S-shaped curls — the defining shape of curly hair
        <svg viewBox="0 0 44 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-6">
            <path d="M6 2 C6 2 2 5 6 9 C10 13 14 10 14 14 C14 18 10 18 6 22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M20 2 C20 2 16 5 20 9 C24 13 28 10 28 14 C28 18 24 18 20 22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M34 2 C34 2 30 5 34 9 C38 13 42 10 42 14 C42 18 38 18 34 22" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M6 22 C6 22 2 25 6 29" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M20 22 C20 22 16 25 20 29" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M34 22 C34 22 30 25 34 29" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
    ),
    coily: (
        // Tight coil springs — distinctly different from curly
        <svg viewBox="0 0 44 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-9 h-6">
            <path d="M8 2 C8 2 4 4 4 7 C4 10 8 11 8 14 C8 17 4 18 4 21 C4 24 8 25 8 28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M22 2 C22 2 18 4 18 7 C18 10 22 11 22 14 C22 17 18 18 18 21 C18 24 22 25 22 28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M36 2 C36 2 32 4 32 7 C32 10 36 11 36 14 C36 17 32 18 32 21 C32 24 36 25 36 28" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" fill="none" />
        </svg>
    ),
};

// ─── Option data ──────────────────────────────────────────────────────────────

const SKIN_TONES = [
    { value: 'very-fair', hex: '#FDDBB4', label: 'Very fair' },
    { value: 'fair', hex: '#F5C89A', label: 'Fair' },
    { value: 'light', hex: '#EBB882', label: 'Light' },
    { value: 'medium', hex: '#D4956A', label: 'Medium' },
    { value: 'olive', hex: '#C28050', label: 'Olive' },
    { value: 'tan', hex: '#A86838', label: 'Tan' },
    { value: 'brown', hex: '#8B5025', label: 'Brown' },
    { value: 'dark-brown', hex: '#6B3518', label: 'Dark brown' },
    { value: 'deep', hex: '#3D1A0A', label: 'Deep' },
];

const UNDERTONES = [
    { value: 'cool', label: 'Cool', desc: 'Pink / rosy / blue hues' },
    { value: 'warm', label: 'Warm', desc: 'Yellow / golden / peachy hues' },
    { value: 'neutral', label: 'Neutral', desc: 'Mix of both' },
];

const BODY_TYPES = [
    { value: 'hourglass', label: 'Hourglass', desc: 'Shoulders & hips equal, defined waist' },
    { value: 'pear', label: 'Pear', desc: 'Hips wider than shoulders' },
    { value: 'apple', label: 'Apple', desc: 'Fuller midsection, slim legs' },
    { value: 'rectangle', label: 'Rectangle', desc: 'Similar width throughout' },
    { value: 'inverted-triangle', label: 'Inv. triangle', desc: 'Broad shoulders, narrow hips' },
    { value: 'ectomorph', label: 'Slim', desc: 'Lean & narrow frame' },
    { value: 'mesomorph', label: 'Athletic', desc: 'Muscular, broad shoulders' },
    { value: 'endomorph', label: 'Curvy / fuller', desc: 'Rounder, fuller proportions' },
];

const HAIR_COLORS = [
    { value: 'black', hex: '#0a0a0a', label: 'Black' },
    { value: 'dark-brown', hex: '#2C1503', label: 'Dark brown' },
    { value: 'medium-brown', hex: '#6B3A1F', label: 'Medium brown' },
    { value: 'light-brown', hex: '#A0522D', label: 'Light brown' },
    { value: 'dark-blonde', hex: '#C8A560', label: 'Dark blonde' },
    { value: 'blonde', hex: '#E8D08A', label: 'Blonde' },
    { value: 'strawberry-blonde', hex: '#D4956A', label: 'Strawberry' },
    { value: 'red', hex: '#A0200F', label: 'Red' },
    { value: 'auburn', hex: '#7B3F00', label: 'Auburn' },
    { value: 'grey', hex: '#9E9E9E', label: 'Grey' },
    { value: 'white', hex: '#E8E8E8', label: 'White' },
];

const HAIR_TYPES = [
    { value: 'straight', label: 'Straight' },
    { value: 'wavy', label: 'Wavy' },
    { value: 'curly', label: 'Curly' },
    { value: 'coily', label: 'Coily' },
];

const HAIR_LENGTHS = [
    { value: 'bald', label: 'Bald / shaved' },
    { value: 'buzz-cut', label: 'Buzz cut' },
    { value: 'short', label: 'Short' },
    { value: 'ear-length', label: 'Ear length' },
    { value: 'chin-length', label: 'Chin length' },
    { value: 'shoulder-length', label: 'Shoulder' },
    { value: 'mid-back', label: 'Mid-back' },
    { value: 'long', label: 'Long' },
    { value: 'very-long', label: 'Very long' },
];

const EYE_COLORS = [
    { value: 'black', hex: '#0a0a0a', label: 'Black' },
    { value: 'dark-brown', hex: '#3B1F09', label: 'Dark brown' },
    { value: 'medium-brown', hex: '#7B4A1E', label: 'Brown' },
    { value: 'hazel', hex: '#8B7355', label: 'Hazel' },
    { value: 'amber', hex: '#C8860A', label: 'Amber' },
    { value: 'green', hex: '#4A7C59', label: 'Green' },
    { value: 'blue-grey', hex: '#6B8CAE', label: 'Blue-grey' },
    { value: 'blue', hex: '#2C6FAC', label: 'Blue' },
    { value: 'grey', hex: '#8E9BAE', label: 'Grey' },
];

const COLOR_PREFS = [
    { value: 'vibrant', label: 'Vibrant', desc: 'Bold, saturated pops', bg: 'from-rose-400 to-violet-500' },
    { value: 'pastel', label: 'Pastel', desc: 'Soft, dreamy tints', bg: 'from-pink-200 to-sky-200' },
    { value: 'neutral', label: 'Neutral', desc: 'Beige, camel, ivory', bg: 'from-stone-300 to-stone-400' },
    { value: 'dark', label: 'Dark', desc: 'Navy, forest, charcoal', bg: 'from-slate-700 to-slate-900' },
    { value: 'earthy', label: 'Earthy', desc: 'Browns, terracotta, rust', bg: 'from-amber-600 to-red-700' },
    { value: 'fresh', label: 'Fresh', desc: 'Mint, sage, lemon', bg: 'from-emerald-300 to-teal-400' },
    { value: 'monochrome', label: 'Monochrome', desc: 'Head-to-toe one colour', bg: 'from-gray-400 to-gray-600' },
];

// ─── Form state ───────────────────────────────────────────────────────────────

interface FormData {
    gender: string;
    skinTone: string; skinUndertone: string;
    bodyType: string;
    height: string; weight: string; age: string;
    hairColor: string; hairType: string; hairLength: string;
    eyeColor: string;
    colorPreferences: string[];
    additionalNotes: string;
    // Step 7 — Style & Lifestyle Preferences
    // Phase 1 — Personalisation
    season: string;
    personality: string;
    lifestyleType: string;
}

interface ExtendedUserProfile {
    season?: string;
    personality?: string;
    lifestyleType?: string;
}

const INITIAL: FormData = {
    gender: '', skinTone: '', skinUndertone: '', bodyType: '',
    height: '165', weight: '65', age: '25',
    hairColor: '', hairType: '', hairLength: '', eyeColor: '',
    colorPreferences: [], additionalNotes: '',
    season: '', personality: '', lifestyleType: '',
};

// ─── Style & Lifestyle option data ────────────────────────────────────────────

const REMOVED_DUPLICATE_STYLE_PREFS = [
    { value: 'minimal',    label: 'Minimal',    desc: 'Clean lines, quiet luxury', emoji: '🤍' },
    { value: 'bold',       label: 'Bold',       desc: 'Statement pieces, high contrast', emoji: '🔥' },
    { value: 'elegant',    label: 'Elegant',    desc: 'Refined, polished, sophisticated', emoji: '✨' },
    { value: 'trendy',     label: 'Trendy',     desc: 'Latest fashion, always current', emoji: '📲' },
    { value: 'sporty',     label: 'Sporty',     desc: 'Athletic, performance-ready', emoji: '⚡' },
    { value: 'streetwear', label: 'Streetwear', desc: 'Urban culture, creative expression', emoji: '🎧' },
];

const LIFESTYLES = [
    { value: 'comfort_first',   label: 'Comfort First',   desc: 'Soft fabrics, relaxed fits always', emoji: '☁️' },
    { value: 'fashion_forward', label: 'Fashion Forward', desc: 'Ahead of trends, style-conscious', emoji: '👠' },
    { value: 'active_outdoor',  label: 'Active & Outdoor', desc: 'On-the-go, functional & fit', emoji: '🏃' },
    { value: 'corporate_formal',label: 'Corporate Formal', desc: 'Professional, structured, polished', emoji: '💼' },
    { value: 'traditional',     label: 'Traditional',     desc: 'Cultural roots, classic heritage', emoji: '🏛️' },
    { value: 'experimental',    label: 'Experimental',    desc: 'Unconventional, avant-garde', emoji: '🎨' },
];

const WEATHER_PREFS = [
    { value: 'hot',      label: 'Hot',      desc: 'Breathable, light fabrics', emoji: '☀️' },
    { value: 'cold',     label: 'Cold',     desc: 'Layered, warm & cozy', emoji: '❄️' },
    { value: 'rainy',    label: 'Rainy',    desc: 'Water-resistant, covered', emoji: '🌧️' },
    { value: 'moderate', label: 'Moderate', desc: 'Versatile for mild climates', emoji: '🌤️' },
];

const LOCATION_TYPES = [
    { value: 'urban',      label: 'Urban',      desc: 'City life, metro vibes', emoji: '🏙️' },
    { value: 'rural',      label: 'Rural',      desc: 'Open spaces, natural settings', emoji: '🌾' },
    { value: 'semi-urban', label: 'Semi-Urban', desc: 'Best of both worlds', emoji: '🏘️' },
];

// Phase 1 — Season & Personality options
const SEASON_OPTS = [
    { value: 'summer',  label: 'Summer',   desc: 'Light fabrics, bright colours', emoji: '☀️' },
    { value: 'winter',  label: 'Winter',   desc: 'Layers, dark rich tones', emoji: '❄️' },
    { value: 'spring',  label: 'Spring',   desc: 'Pastels, florals, fresh looks', emoji: '🌸' },
    { value: 'autumn',  label: 'Autumn',   desc: 'Earthy tones, rust, olive', emoji: '🍂' },
    { value: 'all',     label: 'All Year', desc: 'Versatile, season-independent', emoji: '🌐' },
];

const PERSONALITY_OPTS = [
    { value: 'classic',     label: 'Classic',     desc: 'Timeless, structured elegance', emoji: '👔' },
    { value: 'trendy',      label: 'Trendy',      desc: 'Latest styles, always current', emoji: '🔥' },
    { value: 'bohemian',    label: 'Bohemian',    desc: 'Free spirit, earthy & flowing', emoji: '🌸' },
    { value: 'minimalist',  label: 'Minimalist',  desc: 'Clean lines, quiet luxury', emoji: '⬜' },
    { value: 'bold',        label: 'Bold',        desc: 'Statement pieces, high contrast', emoji: '💥' },
    { value: 'athletic',    label: 'Athletic',    desc: 'Active, sporty, performance', emoji: '🏃' },
    { value: 'traditional', label: 'Traditional', desc: 'Cultural roots, ethnic heritage', emoji: '🪔' },
];

const LIFESTYLE_SIMPLE = [
    { value: 'urban',    label: 'Urban',    desc: 'City life, trends matter', emoji: '🏙️' },
    { value: 'suburban', label: 'Suburban', desc: 'Mix of city & comfort', emoji: '🏘️' },
    { value: 'rural',    label: 'Rural',    desc: 'Practical, traditional, comfort first', emoji: '🌾' },
];

const STEPS = [
    { id: 'gender',    title: 'About you',                  subtitle: 'Tell us the basics to personalise your style' },
    { id: 'skin',      title: 'Skin tone',                  subtitle: 'Helps us recommend colours that complement you' },
    { id: 'body',      title: 'Body & measurements',        subtitle: 'So outfits fit and flatter your shape' },
    { id: 'hair',      title: 'Hair profile',               subtitle: 'Your hair frames every look' },
    { id: 'eyes',      title: 'Eye colour',                 subtitle: 'Subtle but key for colour coordination' },
    { id: 'palette',   title: 'Colour vibe',                subtitle: 'Pick the palettes you love (choose all that apply)' },
    { id: 'lifestyle', title: 'Style & Lifestyle',          subtitle: 'Help us understand your fashion personality and environment' },
    { id: 'review',    title: 'All done!',                  subtitle: "Review your profile — then get your AI outfit recommendations" },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function ChipButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
        <button type="button" onClick={onClick}
            className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition-all duration-200
        ${selected
                    ? 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300 scale-105'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-violet-300'}`}>
            {children}
        </button>
    );
}

function ColorSwatch({ hex, label, selected, onClick }: { hex: string; label: string; selected: boolean; onClick: () => void }) {
    return (
        <button type="button" onClick={onClick} title={label} className="flex flex-col items-center gap-1 group">
            <div
                className={`w-11 h-11 rounded-full border-4 transition-all duration-200
          ${selected ? 'border-violet-500 scale-110 shadow-lg' : 'border-transparent group-hover:border-gray-300'}`}
                style={{ backgroundColor: hex, boxShadow: hex === '#E8E8E8' || hex === '#0a0a0a' ? 'inset 0 0 0 1px rgba(0,0,0,0.15)' : undefined }}
            />
            {selected && <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 max-w-[52px] text-center leading-tight">{label}</span>}
        </button>
    );
}

function CheckIcon() {
    return (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center z-10">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </span>
    );
}

function ProgressBar({ step, total }: { step: number; total: number }) {
    return (
        <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
            <div
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.round((step / (total - 1)) * 100)}%` }}
            />
        </div>
    );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-start py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
            <span className="text-sm text-gray-500 dark:text-gray-400 w-36 shrink-0">{label}</span>
            <span className="text-sm font-medium text-gray-900 dark:text-white text-right">{value || '—'}</span>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BodyProfilePage() {
    const { user, refreshUser } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState(0);
    const [form, setForm] = useState<FormData>(INITIAL);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user) return;
        const bc = user.bodyCharacteristics ?? {};
        setForm({
            gender: user.gender ?? '',
            skinTone: bc.skinTone ?? '',
            skinUndertone: bc.skinUndertone ?? '',
            bodyType: bc.bodyType ?? '',
            height: bc.height != null ? String(bc.height) : '165',
            weight: bc.weight != null ? String(bc.weight) : '65',
            age: bc.age != null ? String(bc.age) : '25',
            hairColor: bc.hairColor ?? '',
            hairType: bc.hairType ?? '',
            hairLength: bc.hairLength ?? '',
            eyeColor: bc.eyeColor ?? '',
            colorPreferences: bc.colorPreferences ?? [],
            additionalNotes: bc.additionalNotes ?? '',
            season:        (user as ExtendedUserProfile).season        ?? '',
            personality:   (user as ExtendedUserProfile).personality   ?? '',
            lifestyleType: (user as ExtendedUserProfile).lifestyleType ?? '',
        });
    }, [user]);

    function set<K extends keyof FormData>(key: K, value: FormData[K]) {
        setForm(prev => ({ ...prev, [key]: value }));
    }
    function togglePref(value: string) {
        setForm(prev => ({
            ...prev,
            colorPreferences: prev.colorPreferences.includes(value)
                ? prev.colorPreferences.filter(v => v !== value)
                : [...prev.colorPreferences, value],
        }));
    }
    const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
    const back = () => setStep(s => Math.max(s - 1, 0));

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            await axios.put('/api/profile/body', {
                gender: form.gender,
                skinTone: form.skinTone, skinUndertone: form.skinUndertone,
                bodyType: form.bodyType,
                height: form.height || null,
                weight: form.weight || null,
                age: form.age || null,
                hairColor: form.hairColor, hairType: form.hairType, hairLength: form.hairLength,
                eyeColor: form.eyeColor,
                colorPreferences: form.colorPreferences,
                additionalNotes: form.additionalNotes,
                season:        form.season,
                personality:   form.personality,
                lifestyleType: form.lifestyleType || 'urban',
            });
            await refreshUser();
            router.push('/themes');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Save failed. Please try again.');
        } finally {
            setSaving(false);
        }
    }

    // ─── Step renders ─────────────────────────────────────────────────────────

    function renderStep() {
        switch (STEPS[step].id) {

            // Step 0 — gender + age
            case 'gender':
                return (
                    <div className="space-y-8">
                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">I identify as</p>
                            <div className="flex flex-wrap gap-3">
                                {[{ v: 'male', l: 'Man' }, { v: 'female', l: 'Woman' }, { v: 'non-binary', l: 'Non-binary' }, { v: 'prefer-not-to-say', l: 'Prefer not to say' }].map(g => (
                                    <ChipButton key={g.v} selected={form.gender === g.v} onClick={() => set('gender', g.v)}>{g.l}</ChipButton>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 block">Age</label>
                            <div className="flex items-center gap-4">
                                <input type="range" min="13" max="80" step="1" value={form.age}
                                    onChange={e => set('age', e.target.value)} className="flex-1 accent-violet-500" />
                                <div className="w-16 text-center">
                                    <span className="text-2xl font-bold text-violet-600">{form.age}</span>
                                    <span className="text-xs text-gray-400 block">yrs</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            // Step 1 — skin tone + undertone
            case 'skin':
                return (
                    <div className="space-y-8">
                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Skin tone</p>
                            <div className="flex flex-wrap gap-4">
                                {SKIN_TONES.map(s => (
                                    <ColorSwatch key={s.value} hex={s.hex} label={s.label}
                                        selected={form.skinTone === s.value} onClick={() => set('skinTone', s.value)} />
                                ))}
                            </div>
                            {form.skinTone && (
                                <p className="mt-3 text-sm text-violet-600 dark:text-violet-400 font-medium">
                                    Selected: {SKIN_TONES.find(s => s.value === form.skinTone)?.label}
                                </p>
                            )}
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Undertone</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {UNDERTONES.map(u => {
                                    const sel = form.skinUndertone === u.value;
                                    return (
                                        <button key={u.value} type="button" onClick={() => set('skinUndertone', u.value)}
                                            className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200
                        ${sel ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]'
                                                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200'}`}>
                                            {sel && <CheckIcon />}
                                            <p className="font-bold text-gray-900 dark:text-white">{u.label}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{u.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );

            // Step 2 — body shape + measurements
            case 'body':
                return (
                    <div className="space-y-8">
                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Body shape</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Each card shows a human silhouette so you can identify your shape easily</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {BODY_TYPES.map(b => {
                                    const sel = form.bodyType === b.value;
                                    return (
                                        <button key={b.value} type="button" onClick={() => set('bodyType', b.value)}
                                            className={`relative flex flex-col items-center gap-2 p-3 pt-4 rounded-2xl border-2 text-center transition-all duration-200
                        ${sel
                                                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 shadow-md shadow-violet-200/40 dark:shadow-violet-900/30 scale-[1.03]'
                                                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200 dark:hover:border-violet-800'}`}>
                                            {sel && <CheckIcon />}
                                            <span className={`transition-colors duration-200 ${sel ? 'text-violet-500' : 'text-gray-300 dark:text-gray-600'}`}>
                                                {BodyShapeSVGs[b.value]}
                                            </span>
                                            <p className={`text-xs font-bold leading-tight ${sel ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {b.label}
                                            </p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{b.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            {[
                                { key: 'height' as const, label: 'Height', min: 130, max: 220, unit: 'cm' },
                                { key: 'weight' as const, label: 'Weight', min: 30, max: 180, unit: 'kg' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 block">{f.label}</label>
                                    <div className="flex items-center gap-3">
                                        <input type="range" min={f.min} max={f.max} step="1"
                                            value={form[f.key]}
                                            onChange={e => set(f.key, e.target.value)}
                                            className="flex-1 accent-violet-500" />
                                        <div className="w-20 text-center">
                                            <span className="text-xl font-bold text-violet-600">{form[f.key]}</span>
                                            <span className="text-xs text-gray-400 block">{f.unit}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            // Step 3 — hair
            case 'hair':
                return (
                    <div className="space-y-8">
                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Hair colour</p>
                            <div className="flex flex-wrap gap-4">
                                {HAIR_COLORS.map(c => (
                                    <ColorSwatch key={c.value} hex={c.hex} label={c.label}
                                        selected={form.hairColor === c.value} onClick={() => set('hairColor', c.value)} />
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Hair texture</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                {HAIR_TYPES.map(t => {
                                    const sel = form.hairType === t.value;
                                    return (
                                        <button key={t.value} type="button" onClick={() => set('hairType', t.value)}
                                            className={`relative flex flex-col items-center gap-3 p-4 rounded-2xl border-2 transition-all duration-200
                        ${sel
                                                    ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]'
                                                    : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200'}`}>
                                            {sel && <CheckIcon />}
                                            <span className={`transition-colors duration-200 ${sel ? 'text-violet-500' : 'text-gray-400 dark:text-gray-500'}`}>
                                                {HairTextureSVGs[t.value]}
                                            </span>
                                            <p className={`text-xs font-semibold ${sel ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {t.label}
                                            </p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Hair length</p>
                            <div className="flex flex-wrap gap-2">
                                {HAIR_LENGTHS.map(l => (
                                    <ChipButton key={l.value} selected={form.hairLength === l.value} onClick={() => set('hairLength', l.value)}>
                                        {l.label}
                                    </ChipButton>
                                ))}
                            </div>
                        </div>
                    </div>
                );

            // Step 4 — eye colour + notes
            case 'eyes':
                return (
                    <div className="space-y-6">
                        <div>
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Eye colour</p>
                            <div className="flex flex-wrap gap-5">
                                {EYE_COLORS.map(e => (
                                    <ColorSwatch key={e.value} hex={e.hex} label={e.label}
                                        selected={form.eyeColor === e.value} onClick={() => set('eyeColor', e.value)} />
                                ))}
                            </div>
                            {form.eyeColor && (
                                <p className="mt-3 text-sm text-violet-600 dark:text-violet-400 font-medium">
                                    Selected: {EYE_COLORS.find(e => e.value === form.eyeColor)?.label}
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
                                Anything else the AI should know? <span className="font-normal text-gray-400">(optional)</span>
                            </label>
                            <textarea rows={3} value={form.additionalNotes}
                                onChange={e => set('additionalNotes', e.target.value)}
                                placeholder="e.g. I prefer modest coverage, I love ethnic wear, I have a petite frame…"
                                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                        </div>
                    </div>
                );

            // Step 5 — colour palette
            case 'palette':
                return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {COLOR_PREFS.map(p => {
                            const sel = form.colorPreferences.includes(p.value);
                            return (
                                <button key={p.value} type="button" onClick={() => togglePref(p.value)}
                                    className={`relative flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all duration-200
                    ${sel
                                            ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]'
                                            : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200'}`}>
                                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.bg} shrink-0`} />
                                    <div>
                                        <p className="font-bold text-sm text-gray-900 dark:text-white">{p.label}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">{p.desc}</p>
                                    </div>
                                    {sel && <CheckIcon />}
                                </button>
                            );
                        })}
                    </div>
                );

            // Step 6 — Style & Lifestyle Preferences
            case 'lifestyle': {
                type SingleKey = keyof FormData;
                function LifestyleSection<T extends { value: string; label: string; desc: string; emoji: string }>(
                    { title, items, field }: { title: string; items: T[]; field: SingleKey }
                ) {
                    return (
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{title}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {items.map(item => {
                                    const sel = form[field] === item.value;
                                    return (
                                        <button key={item.value} type="button"
                                            onClick={() => set(field, sel ? '' : item.value)}
                                            className={`relative flex flex-col items-start gap-1 p-3 rounded-2xl border-2 text-left transition-all duration-200
                                            ${sel
                                                ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]'
                                                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200 dark:hover:border-violet-800'}`}>
                                            {sel && <CheckIcon />}
                                            <span className="text-xl">{item.emoji}</span>
                                            <p className={`text-xs font-bold leading-tight ${sel ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                {item.label}
                                            </p>
                                            <p className="text-[10px] text-gray-400 dark:text-gray-500 leading-tight">{item.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                }

                return (
                    <div className="space-y-7">
                        {/* Phase 1 — Season */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Season you dress for</p>
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                {SEASON_OPTS.map(item => {
                                    const sel = form.season === item.value;
                                    return (
                                        <button key={item.value} type="button" onClick={() => set('season', sel ? '' : item.value)}
                                            className={`relative flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-all duration-200
                                            ${sel ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]'
                                                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200 dark:hover:border-violet-800'}`}>
                                            {sel && <CheckIcon />}
                                            <span className="text-2xl">{item.emoji}</span>
                                            <p className={`text-xs font-bold ${sel ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300'}`}>{item.label}</p>
                                            <p className="text-[9px] text-gray-400 leading-tight">{item.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Phase 1 — Personality */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Style personality</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {PERSONALITY_OPTS.map(item => {
                                    const sel = form.personality === item.value;
                                    return (
                                        <button key={item.value} type="button" onClick={() => set('personality', sel ? '' : item.value)}
                                            className={`relative flex flex-col items-start gap-1 p-3 rounded-2xl border-2 text-left transition-all duration-200
                                            ${sel ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]'
                                                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200 dark:hover:border-violet-800'}`}>
                                            {sel && <CheckIcon />}
                                            <span className="text-xl">{item.emoji}</span>
                                            <p className={`text-xs font-bold ${sel ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300'}`}>{item.label}</p>
                                            <p className="text-[10px] text-gray-400 leading-tight">{item.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Phase 1 — Urban/Rural/Suburban */}
                        <div className="space-y-3">
                            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Environment</p>
                            <div className="grid grid-cols-3 gap-2">
                                {LIFESTYLE_SIMPLE.map(item => {
                                    const sel = form.lifestyleType === item.value;
                                    return (
                                        <button key={item.value} type="button" onClick={() => set('lifestyleType', sel ? '' : item.value)}
                                            className={`relative flex flex-col items-center gap-1 p-3 rounded-2xl border-2 text-center transition-all duration-200
                                            ${sel ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 scale-[1.02]'
                                                : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-violet-200 dark:hover:border-violet-800'}`}>
                                            {sel && <CheckIcon />}
                                            <span className="text-2xl">{item.emoji}</span>
                                            <p className={`text-xs font-bold ${sel ? 'text-violet-700 dark:text-violet-300' : 'text-gray-700 dark:text-gray-300'}`}>{item.label}</p>
                                            <p className="text-[10px] text-gray-400 leading-tight">{item.desc}</p>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                );
            }

            // Step 7 — review
            case 'review': {
                const skinLabel = SKIN_TONES.find(s => s.value === form.skinTone);
                const hairColorLabel = HAIR_COLORS.find(h => h.value === form.hairColor);
                const eyeLabel = EYE_COLORS.find(e => e.value === form.eyeColor);
                const bodyLabel = BODY_TYPES.find(b => b.value === form.bodyType)?.label;
                const hairTypeLabel = HAIR_TYPES.find(t => t.value === form.hairType)?.label;
                const hairLenLabel = HAIR_LENGTHS.find(l => l.value === form.hairLength)?.label;
                const Swatch = ({ hex }: { hex: string }) => (
                    <span className="w-4 h-4 rounded-full border border-gray-200 inline-block shrink-0" style={{ backgroundColor: hex }} />
                );

                return (
                    <div className="space-y-4">
                        <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl p-4 flex gap-3">
                            <span className="text-violet-500 text-lg shrink-0">✨</span>
                            <div>
                                <p className="text-sm font-bold text-violet-800 dark:text-violet-200">What happens next</p>
                                <p className="text-xs text-violet-600 dark:text-violet-400 mt-0.5">
                                     After saving, you&apos;ll go directly to the AI Recommendation Engine. Your skin tone, body shape, and preferences will personalise every outfit suggestion.
                                </p>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                            <ReviewRow label="Gender" value={form.gender} />
                            <ReviewRow label="Age" value={form.age ? `${form.age} yrs` : null} />
                            <ReviewRow label="Skin tone" value={skinLabel ? <span className="flex items-center gap-2 justify-end"><Swatch hex={skinLabel.hex} />{skinLabel.label}</span> : null} />
                            <ReviewRow label="Undertone" value={form.skinUndertone} />
                            <ReviewRow label="Body shape" value={bodyLabel} />
                            <ReviewRow label="Height" value={form.height ? `${form.height} cm` : null} />
                            <ReviewRow label="Weight" value={form.weight ? `${form.weight} kg` : null} />
                            <ReviewRow label="Hair colour" value={hairColorLabel ? <span className="flex items-center gap-2 justify-end"><Swatch hex={hairColorLabel.hex} />{hairColorLabel.label}</span> : null} />
                            <ReviewRow label="Hair type" value={hairTypeLabel} />
                            <ReviewRow label="Hair length" value={hairLenLabel} />
                            <ReviewRow label="Eye colour" value={eyeLabel ? <span className="flex items-center gap-2 justify-end"><Swatch hex={eyeLabel.hex} />{eyeLabel.label}</span> : null} />
                            <ReviewRow label="Colour vibes" value={form.colorPreferences.join(', ') || null} />
                            {form.additionalNotes && <ReviewRow label="Notes" value={form.additionalNotes} />}
                        </div>

                        {/* Style & Lifestyle summary */}
                        {(form.season || form.personality || form.lifestyleType) && (
                            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Style & Lifestyle</p>
                                {form.season && <ReviewRow label="Season" value={SEASON_OPTS.find(s => s.value === form.season)?.label ?? form.season} />}
                                {form.personality && <ReviewRow label="Personality" value={PERSONALITY_OPTS.find(p => p.value === form.personality)?.label ?? form.personality} />}
                                {form.lifestyleType && <ReviewRow label="Environment" value={LIFESTYLE_SIMPLE.find(l => l.value === form.lifestyleType)?.label ?? form.lifestyleType} />}
                            </div>
                        )}
                        {error && (
                            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3 text-sm text-red-600 dark:text-red-400">
                                {error}
                            </div>
                        )}
                    </div>
                );
            }

            default: return null;
        }
    }

    const isLastStep = step === STEPS.length - 1;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-start justify-center py-10 px-4">
            <div className="w-full max-w-2xl">

                {/* Header progress */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                            Step {step + 1} of {STEPS.length}
                        </span>
                        <button type="button" onClick={() => router.push('/dashboard')}
                            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
                            Skip for now →
                        </button>
                    </div>
                    <ProgressBar step={step} total={STEPS.length} />
                </div>

                {/* Card */}
                <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-800 p-8">
                    <div className="mb-8">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{STEPS[step].title}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{STEPS[step].subtitle}</p>
                    </div>

                    <div className="min-h-[260px]">{renderStep()}</div>

                    {/* Nav buttons */}
                    <div className="flex items-center justify-between mt-10 pt-6 border-t border-gray-100 dark:border-gray-800">
                        <button type="button" onClick={back} disabled={step === 0}
                            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            ← Back
                        </button>

                        {isLastStep ? (
                            <button type="button" onClick={handleSave} disabled={saving}
                                className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 text-white font-bold text-sm shadow-md hover:scale-105 active:scale-100 transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                {saving ? 'Saving…' : 'Save & get recommendations →'}
                            </button>
                        ) : (
                            <button type="button" onClick={next}
                                className="px-8 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold text-sm hover:scale-105 active:scale-100 transition-all">
                                Continue →
                            </button>
                        )}
                    </div>
                </div>

                {/* Step dots */}
                <div className="flex justify-center gap-2 mt-6">
                    {STEPS.map((_, i) => (
                        <button key={i} type="button" onClick={() => setStep(i)}
                            className={`rounded-full transition-all duration-300
                ${i === step ? 'w-6 h-2 bg-violet-500' : i < step ? 'w-2 h-2 bg-violet-300' : 'w-2 h-2 bg-gray-200 dark:bg-gray-700'}`} />
                    ))}
                </div>

            </div>
        </div>
    );
}
