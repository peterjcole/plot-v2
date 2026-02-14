import Link from 'next/link';

export const metadata = {
  title: 'About – Plot',
};

export default function AboutPage() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-surface font-sans">
      <main className="w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="text-2xl font-semibold text-text-primary mb-8">About</h1>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Privacy</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Plot connects to Strava to display your activities. No activity data
            is stored on our servers - it is fetched on demand and used only
            within your browser session.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Contact &amp; Feedback</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Plot is open source. If you have feedback, questions, or run into a
            bug, please{' '}
            <a
              href="https://github.com/peter-cole/plot/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-light underline transition-colors"
            >
              open an issue on GitHub
            </a>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-lg font-semibold text-text-primary mb-2">Attribution</h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            Icons by{' '}
            <a
              href="https://lucide.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-light underline transition-colors"
            >
              Lucide
            </a>
            , licensed under the{' '}
            <a
              href="https://github.com/lucide-icons/lucide/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-light underline transition-colors"
            >
              ISC License
            </a>
            .
          </p>
        </section>

        <Link
          href="/"
          className="text-sm font-medium text-primary hover:text-primary-light transition-colors"
        >
          &larr; Back to home
        </Link>
      </main>
    </div>
  );
}
