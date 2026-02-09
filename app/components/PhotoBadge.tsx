interface PhotoBadgeProps {
  number: number;
  size?: number;
}

export default function PhotoBadge({ number, size = 22 }: PhotoBadgeProps) {
  const fontSize = size <= 18 ? 9 : 11;
  return (
    <div
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'rgba(74, 90, 43, 0.82)',
        border: '2px solid rgba(58, 71, 34, 0.9)',
        fontSize,
        fontWeight: 700,
        color: 'white',
        boxShadow: '0 2px 6px rgba(44,44,36,0.3)',
      }}
    >
      <span style={{ fontSize }}>{number}</span>
    </div>
  );
}
