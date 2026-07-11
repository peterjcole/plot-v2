'use client';

interface DeleteRouteConfirmProps {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  style?: React.CSSProperties;
}

export default function DeleteRouteConfirm({ name, onCancel, onConfirm, style }: DeleteRouteConfirmProps) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        width: 208,
        background: 'var(--glass-hvy)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(200,60,60,0.35)',
        borderRadius: 5,
        padding: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        ...style,
      }}
    >
      <div style={{ font: '500 10px/1.5 var(--mono)', color: 'var(--fog)', marginBottom: 10 }}>
        Delete <strong style={{ color: 'var(--ice)', fontWeight: 600 }}>&ldquo;{name}&rdquo;</strong>? This can&apos;t be undone.
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onCancel}
          style={{
            flex: 1, height: 26, borderRadius: 3, font: '600 8.5px/1 var(--mono)', letterSpacing: '.06em',
            textTransform: 'uppercase', cursor: 'pointer', background: 'transparent', border: '1px solid var(--p3)', color: 'var(--fog-dim)',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            flex: 1, height: 26, borderRadius: 3, font: '600 8.5px/1 var(--mono)', letterSpacing: '.06em',
            textTransform: 'uppercase', cursor: 'pointer', background: 'rgba(200,60,60,0.85)', border: 'none', color: 'var(--ice)',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
