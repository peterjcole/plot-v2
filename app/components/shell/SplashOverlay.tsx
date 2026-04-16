'use client';

export default function SplashOverlay({
  onDismiss,
  onPlanRoute,
}: {
  onDismiss: () => void;
  onPlanRoute?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] bg-p0 flex flex-col items-center justify-center overflow-hidden font-mono">
      {/* Wordmark */}
      <div className="font-logo text-[clamp(72px,16vw,108px)] text-ice leading-none mb-7">
        plot
      </div>

      {/* Divider rule */}
      <div className="w-12 h-px bg-gradient-to-r from-transparent via-ora to-transparent mb-7" />

      {/* Tagline */}
      <div className="text-center flex flex-col gap-1.5 mb-11">
        <span className="text-ice text-[0.8125rem] tracking-[0.09em] uppercase">
          Strava activities on OS maps.
        </span>
        <span className="text-fog text-xs tracking-[0.07em] uppercase">
          Route planning + GPX export included.
        </span>
      </div>

      {/* CTAs */}
      <div className="flex flex-col items-center gap-2.5 w-full max-w-[280px] px-6 box-border">
        {/* Primary: Connect with Strava */}
        <a
          href="/api/auth/strava"
          className="flex items-center justify-center gap-2 w-full py-3 px-6 bg-ora text-white rounded-sm text-xs font-mono tracking-[0.1em] uppercase font-semibold no-underline"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
            <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
          </svg>
          Connect with Strava
        </a>

        {/* Secondary: Plan a route */}
        {onPlanRoute && (
          <button
            onClick={onPlanRoute}
            className="w-full py-3 px-6 bg-transparent text-fog border border-ice/20 rounded-sm text-xs font-mono tracking-[0.1em] uppercase cursor-pointer"
          >
            Plan a route{' '}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline align-middle" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="bg-transparent border-0 text-fog-dim text-[0.6875rem] font-mono tracking-[0.09em] uppercase cursor-pointer pt-1.5"
        >
          Peek at the map{' '}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="inline align-middle" aria-hidden="true">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
