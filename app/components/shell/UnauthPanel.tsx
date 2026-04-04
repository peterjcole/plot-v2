export default function UnauthPanel() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      padding: '32px 20px',
      textAlign: 'center',
      gap: 16,
    }}>
      {/* Strava icon */}
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FC4C02" width="32" height="32" aria-hidden="true">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
      </svg>

      <div>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--ice)', fontFamily: 'var(--mono)', marginBottom: 8 }}>
          Connect Strava
        </p>
        <p style={{ fontSize: 11, color: 'var(--fog-dim)', fontFamily: 'var(--mono)', lineHeight: 1.6 }}>
          Sign in to see your activities on the map
        </p>
      </div>

      <a
        href="/api/auth/strava"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 18px',
          background: '#FC4C02',
          borderRadius: 4,
          color: '#fff',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          fontWeight: 600,
          textDecoration: 'none',
          letterSpacing: '0.04em',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
          <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
        </svg>
        Connect with Strava
      </a>
    </div>
  );
}
