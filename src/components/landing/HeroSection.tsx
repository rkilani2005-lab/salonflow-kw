import { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Float, Stars, MeshReflectorMaterial, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useLanguage } from '@/contexts/LanguageContext';

// ── Color palette (Al Hamra Tower / Kuwait luxury night) ──────
const COLORS = {
  bronze:   '#B8924A',
  gold:     '#D4AF37',
  deepBlue: '#0A0E1A',
  skyBlue:  '#88C9E8',
  rose:     '#C0395E',
  ivory:    '#F5F0E8',
};

// ── Al Hamra Tower — procedural geometry ─────────────────────
function AlHamraTower() {
  const groupRef = useRef<THREE.Group>(null);
  const windowsRef = useRef<THREE.InstancedMesh>(null);

  // Window grid — warm amber lights across 12×40 grid
  const windowCount = 12 * 40;
  const { positions, colors: winColors } = useMemo(() => {
    const pos: THREE.Matrix4[] = [];
    const cols: THREE.Color[] = [];
    const dummy = new THREE.Object3D();
    for (let row = 0; row < 40; row++) {
      for (let col = 0; col < 12; col++) {
        const side = col < 3 ? 0 : col < 6 ? 1 : col < 9 ? 2 : 3;
        // Distribute windows on 4 sides of the tower
        const x = side === 0 ? -2.55 : side === 2 ? 2.55 : (col % 3) * 0.8 - 0.8;
        const z = side === 1 ? -2.55 : side === 3 ? 2.55 : (col % 3) * 0.8 - 0.8;
        const y = row * 0.9 - 16;
        const scale = 0.25 + Math.random() * 0.05;

        dummy.position.set(x, y, z);
        if (side === 0) dummy.rotation.set(0, -Math.PI / 2, 0);
        else if (side === 1) dummy.rotation.set(0, 0, 0);
        else if (side === 2) dummy.rotation.set(0, Math.PI / 2, 0);
        else dummy.rotation.set(0, Math.PI, 0);
        dummy.scale.set(scale, scale * 1.6, 1);
        dummy.updateMatrix();
        pos.push(dummy.matrix.clone());

        // Random lit windows with warm amber/white glow
        const lit = Math.random() > 0.35;
        const warmth = 0.7 + Math.random() * 0.3;
        cols.push(lit
          ? new THREE.Color(warmth, warmth * 0.75, warmth * 0.3)
          : new THREE.Color(0.05, 0.05, 0.08));
      }
    }
    return { positions: pos, colors: cols };
  }, []);

  // Apply instanced windows
  useEffect(() => {
    if (!windowsRef.current) return;
    positions.forEach((mat, i) => {
      windowsRef.current!.setMatrixAt(i, mat);
      windowsRef.current!.setColorAt(i, winColors[i]);
    });
    windowsRef.current.instanceMatrix.needsUpdate = true;
    if (windowsRef.current.instanceColor) windowsRef.current.instanceColor.needsUpdate = true;
  }, [positions, winColors]);

  // Gentle slow rotation
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <group ref={groupRef} position={[3, -2, 0]}>
      {/* ── Main tower body ── */}
      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[5.1, 36, 5.1, 1, 1, 1]} />
        <meshStandardMaterial
          color="#1C1C28"
          metalness={0.85}
          roughness={0.25}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* ── Bronze metallic cladding panels ── */}
      {[...Array(18)].map((_, i) => (
        <mesh key={i} position={[0, i * 2 - 17, 0]}>
          <boxGeometry args={[5.15, 0.12, 5.15]} />
          <meshStandardMaterial
            color={COLORS.bronze}
            metalness={0.95}
            roughness={0.1}
            envMapIntensity={2}
          />
        </mesh>
      ))}

      {/* ── Signature curved glass facade (south face) ── */}
      <mesh position={[0, 2, -2.8]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[5.5, 5.5, 36, 32, 1, true, Math.PI * 0.85, Math.PI * 0.3]} />
        <meshStandardMaterial
          color={COLORS.skyBlue}
          metalness={0.1}
          roughness={0.0}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          envMapIntensity={3}
        />
      </mesh>

      {/* ── Second glass layer (inner reflections) ── */}
      <mesh position={[0, 2, -2.6]}>
        <cylinderGeometry args={[5.0, 5.0, 35, 32, 1, true, Math.PI * 0.87, Math.PI * 0.26]} />
        <meshStandardMaterial
          color="#AADDF0"
          metalness={0}
          roughness={0.0}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
          envMapIntensity={4}
        />
      </mesh>

      {/* ── Tower crown / spire ── */}
      <mesh position={[0, 20, 0]}>
        <cylinderGeometry args={[0.3, 2.55, 8, 4]} />
        <meshStandardMaterial color={COLORS.bronze} metalness={0.98} roughness={0.05} />
      </mesh>
      <mesh position={[0, 26, 0]}>
        <cylinderGeometry args={[0.05, 0.3, 4, 4]} />
        <meshStandardMaterial color={COLORS.gold} metalness={1} roughness={0} />
      </mesh>

      {/* ── Podium / base ── */}
      <mesh position={[0, -20, 0]}>
        <boxGeometry args={[8, 4, 8]} />
        <meshStandardMaterial color="#141420" metalness={0.7} roughness={0.4} />
      </mesh>
      {/* Podium bronze trim */}
      <mesh position={[0, -18.1, 0]}>
        <boxGeometry args={[8.1, 0.2, 8.1]} />
        <meshStandardMaterial color={COLORS.bronze} metalness={0.95} roughness={0.1} />
      </mesh>

      {/* ── Instanced windows ── */}
      <instancedMesh ref={windowsRef} args={[undefined, undefined, windowCount]}>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial emissive="#ffffff" emissiveIntensity={1.5} toneMapped={false} />
      </instancedMesh>

      {/* ── Crown beacon light ── */}
      <pointLight position={[0, 28, 0]} color="#FFD700" intensity={15} distance={20} decay={2} />

      {/* ── Interior warm glow ── */}
      <pointLight position={[0, 0, 0]} color="#FF9A3C" intensity={5} distance={15} decay={2} />
    </group>
  );
}

// ── Floating gold geometric shapes ──────────────────────────
function FloatingGems() {
  return (
    <>
      <Float speed={1.4} rotationIntensity={0.8} floatIntensity={0.8} position={[-6, 4, -4]}>
        <mesh>
          <octahedronGeometry args={[0.6]} />
          <meshStandardMaterial color={COLORS.gold} metalness={1} roughness={0.05} emissive={COLORS.gold} emissiveIntensity={0.3} />
        </mesh>
      </Float>

      <Float speed={1.1} rotationIntensity={1.2} floatIntensity={0.6} position={[-8, -2, -6]}>
        <mesh>
          <octahedronGeometry args={[0.4]} />
          <meshStandardMaterial color={COLORS.rose} metalness={0.8} roughness={0.1} emissive={COLORS.rose} emissiveIntensity={0.5} />
        </mesh>
      </Float>

      <Float speed={0.9} rotationIntensity={0.6} floatIntensity={1.0} position={[9, 6, -8]}>
        <mesh>
          <tetrahedronGeometry args={[0.5]} />
          <meshStandardMaterial color={COLORS.bronze} metalness={1} roughness={0.0} emissive={COLORS.bronze} emissiveIntensity={0.2} />
        </mesh>
      </Float>

      <Float speed={1.3} rotationIntensity={0.5} floatIntensity={0.7} position={[7, -5, -5]}>
        <mesh>
          <octahedronGeometry args={[0.3]} />
          <meshStandardMaterial color="#FFFFFF" metalness={0.2} roughness={0.0} emissive="#FFFFFF" emissiveIntensity={0.8} />
        </mesh>
      </Float>
    </>
  );
}

// ── Ground reflection plane ───────────────────────────────────
function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -22, 0]}>
      <planeGeometry args={[80, 80]} />
      <MeshReflectorMaterial
        blur={[400, 100]}
        resolution={512}
        mixBlur={1}
        mixStrength={30}
        roughness={1}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#070B14"
        metalness={0.8}
        mirror={0}
      />
    </mesh>
  );
}

// ── Mouse-tracking camera ────────────────────────────────────
function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = -(e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  useFrame((_, delta) => {
    // Smooth camera drift with mouse
    camera.position.x += (mouse.current.x * 3 - camera.position.x) * delta * 0.8;
    camera.position.y += (mouse.current.y * 1.5 + 2 - camera.position.y) * delta * 0.8;
    camera.lookAt(2, 2, 0);
  });

  return null;
}

// ── City light halos ─────────────────────────────────────────
function CityLights() {
  return (
    <>
      {/* Kuwait skyline glow rings */}
      <pointLight position={[-10, -18, -10]} color="#FF6B2B" intensity={20} distance={30} decay={2} />
      <pointLight position={[10, -18, -8]}  color="#FF8C42" intensity={15} distance={25} decay={2} />
      <pointLight position={[0, -18, 10]}   color="#FFA559" intensity={12} distance={20} decay={2} />
      {/* Moonlight */}
      <directionalLight
        position={[-10, 30, 10]}
        color="#B8C8E8"
        intensity={0.8}
        castShadow
      />
      {/* Ambient night sky */}
      <ambientLight color="#0A1428" intensity={0.6} />
      {/* ZAINA brand accent rim */}
      <pointLight position={[-5, 10, -2]} color={COLORS.rose} intensity={8} distance={20} decay={2} />
    </>
  );
}

// ── Main 3D Scene ─────────────────────────────────────────────
function Scene() {
  return (
    <>
      <CameraRig />
      <CityLights />
      <Environment preset="night" />

      <Stars radius={120} depth={60} count={4000} factor={4} saturation={0.3} fade speed={0.5} />

      <Suspense fallback={null}>
        <AlHamraTower />
        <FloatingGems />
        <GroundPlane />
      </Suspense>

      {/* Atmospheric fog */}
      <fog attach="fog" args={['#070B14', 40, 100]} />
    </>
  );
}

// ── Animated text shimmer keyframes injected once ────────────
const STYLE_ID = 'zaina-hero-style';
function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes zaina-rise { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
    @keyframes zaina-fade { from { opacity:0; } to { opacity:1; } }
    @keyframes zaina-scroll { 0%,100% { transform:translateY(0); opacity:.7; } 50% { transform:translateY(10px); opacity:.2; } }
    @keyframes zaina-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0; }
    }
    .zaina-hero-title {
      background: linear-gradient(135deg, #D4AF37 0%, #F5F0E8 35%, #B8924A 55%, #FFD700 75%, #C0395E 100%);
      background-size: 400px 100%;
      -webkit-background-clip: text;
      background-clip: text;
      -webkit-text-fill-color: transparent;
      animation: zaina-shimmer 5s linear infinite, zaina-rise .9s ease forwards;
      opacity: 0;
    }
    .zaina-sub      { animation: zaina-rise 1s ease .3s forwards; opacity: 0; }
    .zaina-body     { animation: zaina-rise 1s ease .6s forwards; opacity: 0; }
    .zaina-ctas     { animation: zaina-rise 1s ease .9s forwards; opacity: 0; }
    .zaina-trust    { animation: zaina-fade 1.2s ease 1.2s forwards; opacity: 0; }
    .zaina-scroll   { animation: zaina-scroll 2.4s ease-in-out infinite; }
  `;
  document.head.appendChild(s);
}

// ── Hero Section ─────────────────────────────────────────────
export default function HeroSection() {
  const { language, isRTL } = useLanguage();
  const ar = language === 'ar';
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    injectStyles();
    const t = setTimeout(() => setLoaded(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <section
      className="relative min-h-screen w-full overflow-hidden"
      style={{ background: 'linear-gradient(180deg, #070B14 0%, #0D1428 60%, #0A0E1A 100%)' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* ── 3D Canvas ── */}
      <div className="absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 2, 22], fov: 55, near: 0.1, far: 200 }}
          shadows
          gl={{
            antialias: true,
            alpha: false,
            powerPreference: 'high-performance',
            toneMapping: THREE.ACESFilmicToneMapping,
            toneMappingExposure: 0.9,
          }}
          dpr={[1, 2]}
        >
          <Scene />
        </Canvas>
      </div>

      {/* ── Gradient overlays for readability ── */}
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(90deg, rgba(7,11,20,0.92) 0%, rgba(7,11,20,0.6) 50%, rgba(7,11,20,0.1) 100%)' }} />
      <div className="absolute inset-0 z-10 pointer-events-none"
        style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(7,11,20,0.95) 100%)' }} />

      {/* ── Text content ── */}
      <div className="relative z-20 min-h-screen flex flex-col justify-center px-8 md:px-16 lg:px-24 max-w-3xl">
        {/* Al Hamra badge */}
        <div className="zaina-sub mb-6 flex items-center gap-2.5">
          <div className="h-px flex-1 max-w-8"
            style={{ background: 'linear-gradient(90deg, transparent, #D4AF37)' }} />
          <span className="text-[11px] font-bold uppercase tracking-[0.25em]"
            style={{ color: '#D4AF37' }}>
            {ar ? 'كويت • الخليج العربي' : 'Kuwait • Arabian Gulf'}
          </span>
        </div>

        {/* Main headline */}
        <h1
          className="zaina-hero-title font-black leading-none mb-4"
          style={{ fontFamily: 'Syne, sans-serif', fontSize: 'clamp(3.5rem, 8vw, 6.5rem)', letterSpacing: '-0.03em' }}>
          {ar ? 'ZAINA' : 'ZAINA'}
        </h1>

        {/* Sub-headline */}
        <p className="zaina-sub text-lg md:text-xl font-light mb-5 tracking-wide"
          style={{ color: '#B8924A', letterSpacing: '0.12em' }}>
          {ar ? 'صالون مانجمنت • بذكاء اصطناعي' : 'SALON MANAGEMENT · AI-POWERED'}
        </p>

        {/* Body copy */}
        <p className="zaina-body text-sm md:text-base leading-relaxed mb-10 max-w-lg"
          style={{ color: 'rgba(245,240,232,0.7)', lineHeight: '1.75' }}>
          {ar
            ? 'المنصة الأذكى لإدارة الصالونات النسائية في الكويت والخليج. حجوزات لحظية، تقارير ذكية، وعميلاتك يشعرن بالفرق.'
            : 'The smartest platform for ladies\' salons across Kuwait & the GCC. Real-time bookings, intelligent reports, and clients who feel the difference.'}
        </p>

        {/* CTA buttons */}
        <div className="zaina-ctas flex flex-col sm:flex-row gap-4 mb-12">
          <Link to="/auth?mode=signup">
            <button className="group relative px-8 py-4 font-bold text-sm tracking-widest uppercase overflow-hidden rounded-sm transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, #D4AF37, #B8924A)',
                color: '#070B14',
                boxShadow: '0 0 30px rgba(212,175,55,0.3)',
                letterSpacing: '0.2em',
              }}>
              <span className="relative z-10">{ar ? 'ابدأ مجاناً' : 'START FREE TRIAL'}</span>
              {/* Shimmer overlay */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'linear-gradient(135deg, #FFD700, #D4AF37)' }} />
            </button>
          </Link>
          <Link to="/book?demo=true">
            <button className="group px-8 py-4 font-bold text-sm tracking-widest uppercase rounded-sm border transition-all duration-300 hover:border-amber-400"
              style={{
                background: 'transparent',
                color: 'rgba(245,240,232,0.8)',
                border: '1px solid rgba(184,146,74,0.4)',
                letterSpacing: '0.2em',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,146,74,0.1)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              {ar ? 'شاهد العرض' : 'LIVE DEMO'}
            </button>
          </Link>
        </div>

        {/* Trust points */}
        <div className="zaina-trust flex flex-wrap gap-x-6 gap-y-2">
          {[
            { en: '14-day free trial',  ar: '14 يوم مجاناً' },
            { en: 'No credit card',     ar: 'بدون بطاقة' },
            { en: 'Cancel anytime',     ar: 'إلغاء حر' },
          ].map(p => (
            <div key={p.en} className="flex items-center gap-2">
              <div className="h-1 w-1 rounded-full" style={{ background: '#D4AF37' }} />
              <span className="text-xs font-medium" style={{ color: 'rgba(245,240,232,0.5)' }}>
                {ar ? p.ar : p.en}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Al Hamra label (bottom right) ── */}
      <div className="absolute bottom-24 right-8 z-20 text-right hidden lg:block"
        style={{ animation: 'zaina-fade 2s ease 1.5s forwards', opacity: 0 }}>
        <p className="text-[10px] uppercase tracking-[0.3em] mb-1" style={{ color: 'rgba(184,146,74,0.5)' }}>
          {ar ? 'مستوحى من' : 'Inspired by'}
        </p>
        <p className="text-xs font-bold tracking-widest" style={{ color: 'rgba(184,146,74,0.8)', letterSpacing: '0.2em' }}>
          AL HAMRA TOWER
        </p>
        <p className="text-[10px]" style={{ color: 'rgba(184,146,74,0.4)' }}>
          Kuwait City
        </p>
      </div>

      {/* ── Scroll indicator ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
        <div className="zaina-scroll h-10 w-px" style={{ background: 'linear-gradient(180deg, #D4AF37, transparent)' }} />
        <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: 'rgba(212,175,55,0.4)' }}>
          {ar ? 'اكتشفي' : 'Explore'}
        </p>
      </div>

      {/* ── Decorative corner lines ── */}
      <div className="absolute top-8 left-8 z-20 pointer-events-none hidden md:block">
        <div className="h-16 w-px" style={{ background: 'linear-gradient(180deg, #D4AF37, transparent)' }} />
        <div className="h-px w-16" style={{ background: 'linear-gradient(90deg, #D4AF37, transparent)' }} />
      </div>
      <div className="absolute top-8 right-8 z-20 pointer-events-none hidden md:block flex flex-col items-end">
        <div className="h-16 w-px ml-auto" style={{ background: 'linear-gradient(180deg, #D4AF37, transparent)' }} />
        <div className="h-px w-16 ml-auto" style={{ background: 'linear-gradient(270deg, #D4AF37, transparent)' }} />
      </div>
    </section>
  );
}
