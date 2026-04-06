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
        border: '1px solid var(--fog-ghost)',
        borderRadius: '50%',
        background: 'var(--glass)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        cursor: 'pointer',
        flexShrink: 0,
        overflow: 'hidden',
        ...style,
      }}
    >
      <svg
        viewBox="0 0 36 36"
        style={{ display: 'block', transform: `rotate(${bearing}deg)`, transition: 'transform 0.2s' }}
      >
        {/* North arrow — orange */}
        <polygon points="18,4 21,18 18,15 15,18" style={{ fill: 'var(--ora)' }} />
        {/* South arrow — dim */}
        <polygon points="18,32 21,18 18,21 15,18" style={{ fill: 'var(--fog-ghost)' }} />
        <text
          x="18" y="10"
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fill: 'var(--ora)', fontSize: 5, fontFamily: 'var(--mono)', fontWeight: 700 }}
        >N</text>
      </svg>
    </button>
  );
}
