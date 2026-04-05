'use client';

interface PlannerPanelProps {
  distance: number;
  elevGain: number;
}

function fmtDist(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export default function PlannerPanel({ distance, elevGain }: PlannerPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '20px 14px' }}>
      <div>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
          Distance
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color: distance > 0 ? 'var(--ice)' : 'var(--fog-ghost)', fontFamily: 'var(--mono)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {distance > 0 ? fmtDist(distance) : '—'}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 6 }}>
          Elevation gain
        </div>
        <div style={{ fontSize: 22, fontWeight: 600, color: elevGain > 0 ? 'var(--ice)' : 'var(--fog-ghost)', fontFamily: 'var(--mono)' }}>
          {elevGain > 0 ? `+${Math.round(elevGain)} m` : '—'}
        </div>
      </div>

      <p style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', lineHeight: 1.7, borderTop: '1px solid var(--fog-ghost)', paddingTop: 16, marginTop: -8 }}>
        Click the map to add waypoints. Use the toolbar to undo, snap to roads, and export your route.
      </p>
    </div>
  );
}
