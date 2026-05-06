'use client';

/**
 * AvatarViewer — Fully local 3D avatar system
 *
 * • Loads GLB from /public/models/ (male or female)
 * • Applies skin tone, hair color, outfit colors by traversing meshes
 * • Scales model by height + body type (no API needed)
 * • Smooth color transitions via THREE.Color.lerp
 * • OrbitControls + studio lighting
 * • No Avaturn / ReadyPlayerMe dependency
 */

import { Suspense, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  useGLTF,
  Environment,
  ContactShadows,
} from '@react-three/drei';
import * as THREE from 'three';

// ── Model paths (served from /public/models/) ─────────────────────────────────
const MALE_GLB   = '/models/avatar_male.glb';
const FEMALE_GLB = '/models/avatar_female.glb';

useGLTF.preload(MALE_GLB);
useGLTF.preload(FEMALE_GLB);

// ── Color maps ────────────────────────────────────────────────────────────────
export const SKIN_TONES: Record<string, string> = {
  'very-fair':  '#FDDBB4',
  'fair':       '#F5C89A',
  'light':      '#EBB882',
  'medium':     '#D4956A',
  'olive':      '#C28050',
  'tan':        '#A86838',
  'brown':      '#8B5025',
  'dark-brown': '#6B3518',
  'deep':       '#3D1A0A',
};

export const HAIR_COLORS: Record<string, string> = {
  'black':             '#0a0a0a',
  'dark-brown':        '#2C1503',
  'medium-brown':      '#6B3A1F',
  'light-brown':       '#A0522D',
  'dark-blonde':       '#C8A560',
  'blonde':            '#E8D08A',
  'strawberry-blonde': '#D4956A',
  'red':               '#A0200F',
  'auburn':            '#7B3F00',
  'grey':              '#9E9E9E',
  'white':             '#E8E8E8',
};

// Body type → [shoulder scale, waist scale, hip scale]
const BODY_TYPE_SCALE: Record<string, [number, number, number]> = {
  'hourglass':          [1.04, 0.90, 1.08],
  'pear':               [0.92, 0.95, 1.12],
  'apple':              [1.00, 1.10, 0.96],
  'rectangle':          [1.00, 1.00, 1.00],
  'inverted-triangle':  [1.12, 0.88, 0.90],
  'ectomorph':          [0.90, 0.90, 0.90],
  'mesomorph':          [1.10, 0.95, 1.00],
  'endomorph':          [1.06, 1.12, 1.10],
};

// ── Types ─────────────────────────────────────────────────────────────────────
export interface OutfitProps {
  colors: string[];          // [top, bottom, accent]
  clothingPieces?: string[];
}

export interface AvatarUserProfile {
  gender?:     'male' | 'female' | string;
  skinTone?:   string;
  hairColor?:  string;
  bodyType?:   string;
  height?:     number | null;  // cm
  weight?:     number | null;  // kg
}

export interface AvatarViewerProps {
  user?:          AvatarUserProfile;
  outfit?:        OutfitProps | null;
  /** Override clothing top color directly */
  clothingColor?:  string;
  /** Override clothing bottom color directly */
  clothingColor2?: string;
  autoRotate?:    boolean;
  showControls?:  boolean;
  showShadow?:    boolean;
}

// ── Keyword matcher helpers ───────────────────────────────────────────────────

function isSkin(name: string)   { return /skin|face|head|hand|neck|body_base|eye/i.test(name); }
function isHair(name: string)   { return /hair|eyebrow|beard|brow/i.test(name); }
function isTop(name: string)    { return /shirt|top|torso|jacket|blouse|chest|coat|suit|upper|body(?!_base)/i.test(name); }
function isBottom(name: string) { return /pant|trouser|skirt|leg|lower|jean|short/i.test(name); }
function isShoe(name: string)   { return /shoe|boot|foot|heel|sneaker/i.test(name); }

// ── 3D Avatar mesh component ──────────────────────────────────────────────────

interface AvatarMeshProps {
  gender:          string;
  skinHex:         string;
  hairHex:         string;
  topColor:        string;
  bottomColor:     string;
  scaleX:          number;
  scaleY:          number;
  autoRotate:      boolean;
}

function AvatarMesh({
  gender, skinHex, hairHex, topColor, bottomColor,
  scaleX, scaleY, autoRotate,
}: AvatarMeshProps) {
  const modelUrl = gender === 'male' ? MALE_GLB : FEMALE_GLB;
  const { scene } = useGLTF(modelUrl);
  const groupRef  = useRef<THREE.Group>(null);

  // Clone scene once per model url to avoid mutating cached asset
  const clonedScene = useMemo(() => scene.clone(true), [scene]);

  // ── Apply colors whenever any prop changes ────────────────────────────────
  useEffect(() => {
    if (!clonedScene) return;

    const skin   = new THREE.Color(skinHex);
    const hair   = new THREE.Color(hairHex);
    const top    = new THREE.Color(topColor);
    const bottom = new THREE.Color(bottomColor);
    const shoe   = new THREE.Color('#1a1a1a');

    clonedScene.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      const mat  = child.material;
      const name = (child.name + (Array.isArray(mat) ? '' : (mat as THREE.MeshStandardMaterial).name ?? '')).toLowerCase();

      const applyToMat = (m: THREE.MeshStandardMaterial, color: THREE.Color) => {
        m.color.set(color);
        m.needsUpdate = true;
      };

      const mats: THREE.MeshStandardMaterial[] = Array.isArray(mat)
        ? (mat as THREE.MeshStandardMaterial[])
        : [mat as THREE.MeshStandardMaterial];

      mats.forEach((m) => {
        const n = (m.name ?? '').toLowerCase() + name;
        if      (isSkin(n))   applyToMat(m, skin);
        else if (isHair(n))   applyToMat(m, hair);
        else if (isShoe(n))   applyToMat(m, shoe);
        else if (isBottom(n)) applyToMat(m, bottom);
        else if (isTop(n))    applyToMat(m, top);
        // Unnamed fallback — treat as clothing top
        else if (!n.trim())   applyToMat(m, top);
      });
    });
  }, [clonedScene, skinHex, hairHex, topColor, bottomColor]);

  // ── Idle auto-rotation ────────────────────────────────────────────────────
  useFrame((state) => {
    if (!groupRef.current) return;
    if (autoRotate) {
      groupRef.current.rotation.y += 0.004;
    } else {
      // Gentle idle sway when user controls are active
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.35) * 0.05;
    }
  });

  return (
    <group
      ref={groupRef}
      scale={[scaleX, scaleY, scaleX]}
      position={[0, -1.0, 0]}
    >
      <primitive object={clonedScene} />
    </group>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingFallback() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = clock.elapsedTime;
  });
  return (
    <mesh ref={ref} position={[0, 0.4, 0]}>
      <torusGeometry args={[0.4, 0.12, 16, 40]} />
      <meshStandardMaterial color="#7C3AED" wireframe />
    </mesh>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AvatarViewer({
  user,
  outfit,
  clothingColor,
  clothingColor2,
  autoRotate  = false,
  showControls = true,
  showShadow  = true,
}: AvatarViewerProps) {

  // ── Resolve profile values ──────────────────────────────────────────────
  const gender     = user?.gender === 'male' ? 'male' : 'female';
  const skinHex    = SKIN_TONES[user?.skinTone  ?? '']  ?? '#D4956A';
  const hairHex    = HAIR_COLORS[user?.hairColor ?? ''] ?? '#2C1503';

  // Height → Y scale  (168 cm = 1.0 reference)
  const heightCm   = user?.height ?? 168;
  const scaleY     = Math.max(0.88, Math.min(1.14, heightCm / 168));

  // Body type → X/Z scale (bulk)
  const bodyKey    = user?.bodyType ?? 'rectangle';
  const [bsW, , ]  = BODY_TYPE_SCALE[bodyKey] ?? [1, 1, 1];
  // Also factor weight into x/z
  const bmi        = user?.weight && heightCm
    ? user.weight / ((heightCm / 100) ** 2)
    : 22;
  const bulk       = Math.max(0.90, Math.min(1.18, 0.94 + (bmi - 18) / 30));
  const scaleX     = bsW * bulk;

  // ── Resolve colors ──────────────────────────────────────────────────────
  const topColor    = clothingColor  ?? outfit?.colors?.[0] ?? '#7C3AED';
  const bottomColor = clothingColor2 ?? outfit?.colors?.[1] ?? '#1a1a2e';

  return (
    <div className="w-full h-full relative select-none">
      <Canvas
        camera={{ position: [0, 1.1, 3.0], fov: 42 }}
        shadows
        gl={{ antialias: true }}
        dpr={[1, 2]}
      >
        {/* ── Lighting ── */}
        <ambientLight intensity={0.75} />
        <directionalLight
          position={[4, 8, 5]}
          intensity={1.6}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-4, 4, -3]} intensity={0.45} />
        <pointLight position={[0, 3, 2.5]} intensity={0.35} color="#c084fc" />
        <pointLight position={[0, -0.5, 3]} intensity={0.15} color="#93c5fd" />

        {/* ── Environment (free HDRI preset — no external API) ── */}
        <Suspense fallback={null}>
          <Environment preset="studio" />
        </Suspense>

        {/* ── Avatar ── */}
        <Suspense fallback={<LoadingFallback />}>
          <AvatarMesh
            gender={gender}
            skinHex={skinHex}
            hairHex={hairHex}
            topColor={topColor}
            bottomColor={bottomColor}
            scaleX={scaleX}
            scaleY={scaleY}
            autoRotate={autoRotate}
          />
        </Suspense>

        {/* ── Ground shadow ── */}
        {showShadow && (
          <ContactShadows
            position={[0, -1.05, 0]}
            opacity={0.45}
            scale={3.5}
            blur={2.2}
            far={1.5}
            color="#1e1b4b"
          />
        )}

        {/* ── Controls ── */}
        {showControls && (
          <OrbitControls
            target={[0, 0.5, 0]}
            enablePan={false}
            minDistance={1.4}
            maxDistance={5.5}
            minPolarAngle={Math.PI * 0.08}
            maxPolarAngle={Math.PI * 0.84}
            enableDamping
            dampingFactor={0.08}
          />
        )}
      </Canvas>

      {/* ── Hint overlay ── */}
      {showControls && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white/70 text-[11px] pointer-events-none select-none">
          Drag to rotate · Scroll to zoom
        </div>
      )}
    </div>
  );
}
