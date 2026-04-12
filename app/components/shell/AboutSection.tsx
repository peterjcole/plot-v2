'use client';

interface AboutSectionProps {
  onBack: () => void;
}

export default function AboutSection({ onBack }: AboutSectionProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--fog-ghost)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: 'none', color: 'var(--fog-dim)',
            fontFamily: 'var(--mono)', fontSize: 10, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 20px' }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            Privacy
          </div>
          <p style={{ fontSize: 11, color: 'var(--fog)', fontFamily: 'var(--mono)', lineHeight: 1.7, margin: 0 }}>
            Plot connects to Strava to display your personal activity data. No activity data is stored on our servers.
            Data is fetched directly from Strava&apos;s API and displayed in your browser.
          </p>
        </div>

        <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 20 }} />

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            Feedback
          </div>
          <a
            href="https://github.com/peterjcole/plot-v2/issues"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report an issue on GitHub"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              fontSize: 11, color: 'var(--ora)', fontFamily: 'var(--mono)',
              textDecoration: 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
            Report bugs and feedback on GitHub
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </div>

        <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 20 }} />

        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            Attribution
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { name: 'OpenLayers', license: 'BSD-2-Clause' },
              { name: 'Lucide', license: 'ISC' },
              { name: 'IBM Plex Mono', license: 'OFL-1.1' },
            ].map(({ name, license }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 10, color: 'var(--fog)', fontFamily: 'var(--mono)' }}>{name}</span>
                <span style={{ fontSize: 9, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>{license}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
