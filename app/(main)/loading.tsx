export default function Loading() {
  return (
    <div className="fixed inset-0 z-[100] bg-p0 flex flex-col items-center justify-center font-mono">
      {/* Wordmark */}
      <div className="font-logo text-[clamp(72px,16vw,108px)] text-ice leading-none mb-11">
        plot
      </div>

      {/* GPS ping — center dot with expanding contour rings */}
      <div className="relative w-20 h-20 flex items-center justify-center">
        <div className="w-1.5 h-1.5 rounded-full bg-ora z-10" />
        <div className="absolute rounded-full border-[1.5px] border-ora animate-contour-ping" />
        <div className="absolute rounded-full border-[1.5px] border-ora animate-contour-ping [animation-delay:0.7s]" />
        <div className="absolute rounded-full border-[1.5px] border-ora animate-contour-ping [animation-delay:1.4s]" />
      </div>
    </div>
  );
}
