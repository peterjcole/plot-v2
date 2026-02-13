'use client';

export default function LoginButton() {
  return (
    <a
      href="/api/auth/strava"
      className="inline-flex items-center gap-2 rounded-md bg-[#FC4C02] px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-[#e04400]"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-5 w-5"
        aria-hidden="true"
      >
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
      </svg>
      Connect with Strava
    </a>
  );
}
