'use client';

interface CompassProps {
  bearing: number; // degrees CW from north (positive = clockwise rotation needed)
  onResetNorth: () => void;
  style?: React.CSSProperties;
}

export default function Compass({ bearing, onResetNorth, style }: CompassProps) {
  const norm = ((bearing % 360) + 360) % 360;
  if (norm < 0.5 || norm > 359.5) return null;

  return (
    <button
      onClick={onResetNorth}
      aria-label={`Compass, bearing ${Math.round(norm)}°. Click to reset north.`}
      style={{
        width: 36,
        height: 36,
        padding: 0,
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 36 36"
        style={{ display: 'block', transform: `rotate(${bearing}deg)`, transition: 'transform 0.2s' }}
      >
        <circle cx="18" cy="18" r="16" fill="rgba(7,14,20,0.78)" stroke="#1E4858" strokeWidth="1" />
        <polygon points="18,4 21,18 18,15 15,18" fill="#E07020" />
        <polygon points="18,32 21,18 18,21 15,18" fill="rgba(240,248,250,0.32)" />
        <text
          x="18" y="10.5"
          textAnchor="middle"
          dominantBaseline="central"
          fill="#E07020"
          fontSize="5"
          fontFamily="IBM Plex Mono"
          fontWeight="700"
        >N</text>
      </svg>
    </button>
  );
}
