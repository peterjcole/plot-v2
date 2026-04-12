'use client';

interface MapLegendProps {
  style?: React.CSSProperties;
}

const ITEMS = [
  { label: 'Runs', color: 'var(--ora)' },
  { label: 'Hikes', color: 'var(--grn)' },
  { label: 'Cycles', color: 'var(--blu)' },
];

export default function MapLegend({ style }: MapLegendProps) {
  return (
    <div
      role="img"
      aria-label="Activity type legend"
      style={{
        background: 'var(--glass)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--p3)',
        borderRadius: 4,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        ...style,
      }}
    >
      {ITEMS.map(({ label, color }) => (
        <div
          key={label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 8,
            fontWeight: 500,
            fontFamily: 'var(--mono)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--fog-dim)',
            lineHeight: 1,
          }}
        >
          <div style={{ width: 20, height: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
          {label}
        </div>
      ))}
    </div>
  );
}
