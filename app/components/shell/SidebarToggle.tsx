'use client';

interface SidebarToggleProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  return (
    <div
      className="hidden sm:flex"
      style={{
        position: 'absolute',
        top: '50%',
        left: 0,
        transform: 'translateY(-50%)',
        zIndex: 20,
        alignItems: 'flex-start',
      }}
    >
      <button
        onClick={onToggle}
        aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        style={{
          width: 14,
          height: 48,
          borderRadius: '0 6px 6px 0',
          background: 'var(--p2)',
          border: '1px solid var(--p3)',
          borderLeft: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 0,
          color: 'var(--fog-dim)',
          boxShadow: '2px 0 8px rgba(0,0,0,0.35)',
          transition: 'background 0.15s, color 0.15s, box-shadow 0.15s',
          position: 'relative',
          overflow: 'hidden',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget;
          el.style.background = 'var(--p3)';
          el.style.color = 'var(--ora)';
          el.style.boxShadow = '2px 0 12px rgba(224,112,32,0.2)';
        }}
        onMouseLeave={e => {
          const el = e.currentTarget;
          el.style.background = 'var(--p2)';
          el.style.color = 'var(--fog-dim)';
          el.style.boxShadow = '2px 0 8px rgba(0,0,0,0.35)';
        }}
      >
        {/* Decorative tick marks — HUD detail */}
        <span style={{
          position: 'absolute',
          top: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 4,
          height: 1,
          background: 'var(--p4)',
          borderRadius: 1,
          display: 'block',
        }} />
        <span style={{
          position: 'absolute',
          bottom: 8,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 4,
          height: 1,
          background: 'var(--p4)',
          borderRadius: 1,
          display: 'block',
        }} />

        {/* Chevron — rotates 180° when collapsed */}
        <svg
          width="8"
          height="8"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s ease',
            flexShrink: 0,
          }}
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
    </div>
  );
}
