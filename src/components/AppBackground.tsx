export default function AppBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
      {/*
        PERF: Completely static ambient gradient orbs.
        Zero continuous animations = Zero dirty pixel invalidations.
        The browser rasterises this once and caches it on the GPU,
        enabling silky 60-120fps scrolling and instant tab transitions.
      */}
      <div
        className="absolute -top-[10%] -left-[10%] h-[55%] w-[55%] rounded-full
                   bg-gradient-to-br from-violet-400/50 to-fuchsia-400/50 blur-[60px]"
      />
      <div
        className="absolute -bottom-[10%] -right-[10%] h-[60%] w-[60%] rounded-full
                   bg-gradient-to-tr from-emerald-300/45 to-cyan-300/45 blur-[60px]"
      />
      <div
        className="absolute top-[20%] right-[15%] h-[35%] w-[35%] rounded-full
                   bg-gradient-to-bl from-blue-300/40 to-indigo-300/40 blur-[50px]"
      />
      <div
        className="absolute bottom-[20%] left-[15%] h-[35%] w-[35%] rounded-full
                   bg-gradient-to-tr from-rose-300/35 to-orange-300/35 blur-[50px]"
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
