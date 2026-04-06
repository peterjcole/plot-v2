'use client';

interface ScaleBarProps {
  metersPerPixel: number;
}

const SNAP_VALUES = [50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const TARGET_PX = 60;

export default function ScaleBar({ metersPerPixel }: ScaleBarProps) {
  if (!metersPerPixel || metersPerPixel <= 0) return null;

  const ideal = metersPerPixel * TARGET_PX;
  const snap = SNAP_VALUES.reduce((prev, curr) =>
    Math.abs(curr - ideal) < Math.abs(prev - ideal) ? curr : prev
  );
  const barPx = Math.round(snap / metersPerPixel);
  const label = snap >= 1000 ? `${snap / 1000} km` : `${snap} m`;

  return (
    <div
      role="img"
      aria-label={`Scale: ${label}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        background: 'var(--glass)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        borderRadius: 4,
        padding: '5px 6px',
      }}
    >
      <div style={{
        width: barPx,
        height: 3,
        background: 'linear-gradient(to right, var(--fog) 0%, var(--fog) 50%, var(--p4) 50%, var(--p4) 100%)',
        border: '1px solid var(--fog-ghost)',
        borderRadius: 1,
      }} />
      <span style={{
        fontSize: 8,
        color: 'var(--fog-dim)',
        fontFamily: 'var(--mono)',
        letterSpacing: '0.06em',
        lineHeight: 1,
      }}>
        {label}
      </span>
    </div>
  );
}
