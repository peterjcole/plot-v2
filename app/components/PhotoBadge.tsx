interface PhotoBadgeProps {
  number: number;
}

export default function PhotoBadge({ number }: PhotoBadgeProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 6,
        top: 6,
        width: 22,
        height: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        background: 'rgba(74, 90, 43, 0.82)',
        border: '2px solid rgba(58, 71, 34, 0.9)',
        fontSize: 11,
        fontWeight: 700,
        color: 'white',
        boxShadow: '0 2px 6px rgba(44,44,36,0.3)',
      }}
    >
      {number}
    </div>
  );
}
