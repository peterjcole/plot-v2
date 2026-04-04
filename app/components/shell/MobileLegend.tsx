export default function MobileLegend() {
  return (
    <div style={{
      position: 'absolute',
      top: 62,
      right: 12,
      background: 'rgba(7,14,20,0.80)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      border: '1px solid var(--p3)',
      borderRadius: 20,
      padding: '5px 10px',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      zIndex: 10,
    }}>
      {(['var(--ora)', 'var(--grn)', 'var(--blu)'] as const).map((color, i) => (
        <div
          key={i}
          style={{ width: 14, height: 3, borderRadius: 2, background: color }}
        />
      ))}
    </div>
  );
}
