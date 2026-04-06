import Link from 'next/link';

export const metadata = {
  title: 'About – Plot',
};

export default function AboutPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--p0)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0,
        height: 50,
        background: 'var(--glass)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--fog-ghost)',
        display: 'flex', alignItems: 'center', padding: '0 16px',
        zIndex: 10,
      } as React.CSSProperties}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--display)', fontSize: 20, color: 'var(--ice)', lineHeight: 1 }}>
            plot
          </span>
        </Link>
      </header>

      {/* Content */}
      <main style={{ flex: 1, maxWidth: 520, margin: '0 auto', padding: '24px 16px 48px', width: '100%' }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            Privacy
          </div>
          <p style={{ fontSize: 12, color: 'var(--fog)', fontFamily: 'var(--mono)', lineHeight: 1.8, margin: 0 }}>
            Plot connects to Strava to display your personal activity data. No activity data is stored on our servers.
            Data is fetched directly from Strava&apos;s API and displayed in your browser.
          </p>
        </div>

        <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 24 }} />

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
            Feedback
          </div>
          <a
            href="https://github.com/peterjcole/plot-v2/issues"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Report an issue on GitHub"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 12, color: 'var(--ora)', fontFamily: 'var(--mono)',
              textDecoration: 'none',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/>
            </svg>
            Report bugs and feedback on GitHub →
          </a>
        </div>

        <div style={{ height: 1, background: 'var(--fog-ghost)', marginBottom: 24 }} />

        <div>
          <div style={{ fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fog-dim)', fontFamily: 'var(--mono)', marginBottom: 10 }}>
            Attribution
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { name: 'OpenLayers', license: 'BSD-2-Clause' },
              { name: 'Lucide', license: 'ISC' },
              { name: 'IBM Plex Mono', license: 'OFL-1.1' },
            ].map(({ name, license }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--fog)', fontFamily: 'var(--mono)' }}>{name}</span>
                <span style={{ fontSize: 10, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', letterSpacing: '0.06em' }}>{license}</span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
