export default function LogoWatermark() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 8,
        right: 16,
        zIndex: 1001,
        padding: '3px 8px',
        borderRadius: 3,
        background: 'rgba(255, 248, 236, 0.6)',
      }}
    >
      <span
        style={{
          fontFamily: "'Ribeye Marrow', serif",
          fontSize: 16,
          color: 'var(--primary)',
          lineHeight: 1,
        }}
      >
        plot.fit
      </span>
    </div>
  );
}
