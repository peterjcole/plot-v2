export default function RenderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <head>
        <meta httpEquiv="Referrer-Policy" content="no-referrer" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap"
          rel="stylesheet"
          referrerPolicy="no-referrer"
        />
      </head>
      <body style={{ margin: 0, padding: 0, overflow: 'hidden', fontFamily: "'Inter', system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
