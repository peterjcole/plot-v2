'use client';

import { useEffect, useState } from 'react';

interface StatusBarProps {
  avatarInitials?: string;
}

export default function StatusBar({ avatarInitials = '?' }: StatusBarProps) {
  const [time, setTime] = useState('');

  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setTime(fmt());
    const id = setInterval(() => setTime(fmt()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        height: 28,
        display: 'flex',
        alignItems: 'center',
        padding: '0 10px',
        gap: 6,
        background: 'var(--p0)',
        borderBottom: '1px solid var(--fog-ghost)',
        flexShrink: 0,
      }}
    >
      {/* Time */}
      <span style={{ fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.04em' }}>
        {time}
      </span>

      <div style={{ flex: 1 }} />

      {/* Sync indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--grn)',
            boxShadow: '0 0 5px var(--grn)',
            display: 'inline-block',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.02em' }}>synced</span>
      </div>

      {/* Avatar */}
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--ora)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 9,
          fontWeight: 700,
          color: '#fff',
          fontFamily: 'var(--mono)',
          letterSpacing: 0,
        }}
      >
        {avatarInitials.slice(0, 2).toUpperCase()}
      </div>
    </div>
  );
}
