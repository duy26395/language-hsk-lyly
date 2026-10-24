/**
 * AppBackground — Performance-optimised decorative background.
 *
 * PERF CHANGES (2026-10):
 *  - Removed framer-motion from gradient orbs. Heavy blur-[100px] elements
 *    animated with scale/rotate/translate on every frame forced the GPU to
 *    re-composite on each tick, causing sustained 90–100% GPU utilisation.
 *  - Orbs now use a single lightweight CSS @keyframes animation that only
 *    animates `opacity` (cheap compositor property) so browsers can skip the
 *    paint step entirely via GPU layer promotion.
 *  - Removed floating icons altogether – they ran 8 simultaneous Framer Motion
 *    timelines with x/y/rotate/scale/opacity combined, burning CPU on the main
 *    thread. The decorative value was negligible at their low opacity.
 *  - Removed the SVG feTurbulence / mix-blend-overlay noise overlay.
 *    At opacity 0.02 it was invisible but forced a software-compositor pass
 *    (cannot be GPU-accelerated when mix-blend-overlay is active).
 *  - Dot grid kept as a purely CSS background-image – zero JS, zero paint cost.
 */

export default function AppBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/* Static gradient orbs – GPU-promoted via will-change:opacity */}
      {/* Only opacity is animated, which stays entirely on the compositor thread */}
      <div
        className="app-orb absolute -top-[10%] -left-[10%] h-[60%] w-[60%] rounded-full
                   bg-gradient-to-br from-violet-400/70 to-fuchsia-400/70 blur-[80px]"
        style={{ willChange: 'opacity' }}
      />
      <div
        className="app-orb app-orb--delay-8 absolute -bottom-[10%] -right-[10%] h-[65%] w-[65%] rounded-full
                   bg-gradient-to-tr from-emerald-300/60 to-cyan-300/60 blur-[80px]"
        style={{ willChange: 'opacity' }}
      />
      <div
        className="app-orb app-orb--delay-4 absolute top-[18%] right-[12%] h-[40%] w-[40%] rounded-full
                   bg-gradient-to-bl from-blue-300/60 to-indigo-300/60 blur-[60px]"
        style={{ willChange: 'opacity' }}
      />
      <div
        className="app-orb app-orb--delay-12 absolute bottom-[18%] left-[12%] h-[38%] w-[38%] rounded-full
                   bg-gradient-to-tr from-rose-300/55 to-orange-300/55 blur-[70px]"
        style={{ willChange: 'opacity' }}
      />

      {/* Subtle dot grid – pure CSS, zero JS overhead */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(#6366f1 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}
