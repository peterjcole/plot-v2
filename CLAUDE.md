# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start Next.js dev server (http://localhost:3000)
- `npm run build` — Production build. **run this locally before committing to verify output.**
- `npm run lint` — Run ESLint (flat config, core-web-vitals + typescript)

No test framework is configured.

## Architecture

This is a Next.js 16 app (App Router, TypeScript, Tailwind v4) that generates screenshot images of activity maps. It renders a Leaflet map with an activity route, photos, and stats, then uses Puppeteer to capture the result as a PNG/JPEG.

### Route Groups

- `(main)` — Standard app pages with fonts/global CSS (currently default Next.js landing page)
- `(render)` — Minimal layout (no fonts/styles) used exclusively for Puppeteer screenshot rendering. The render layout strips all margin/padding/overflow so the page captures cleanly.

### Screenshot Pipeline

1. **API route** (`app/api/activity-printout/route.ts`) — Entry point. Accepts `activityId`, `width`, `height`, `format` query params. Launches headless Chromium via Puppeteer, navigates to the render page, waits for `window.__MAP_READY__`, then captures a screenshot.
2. **Render page** (`app/(render)/render/[activityId]/page.tsx`) — Server component that fetches activity data and passes it to `RenderClient`.
3. **RenderClient** — Client component that dynamically imports `ActivityMap` with SSR disabled (Leaflet requires browser APIs).
4. **ActivityMap** — Renders a `react-leaflet` MapContainer with route polyline, photo markers, tile layer, and a text overlay with stats. Sets `window.__MAP_READY__ = true` once tiles load (with a 5s fallback timeout).

### Key Libraries

- `@sparticuz/chromium` + `puppeteer-core` — Headless Chrome for screenshots (configured as `serverExternalPackages` in `next.config.ts`)
- `react-leaflet` / `leaflet` — Map rendering (client-side only, must use `next/dynamic` with `ssr: false`)

### Data Layer

`lib/strava.ts` currently returns mock data. It's designed to be replaced with real Strava API calls. Types are defined in `lib/types.ts` (`ActivityData`, `ActivityPhoto`, `ActivityStats`).

### Path Alias

`@/*` maps to the project root (configured in `tsconfig.json`).
