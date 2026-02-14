<p align="center">
  <a href="https://plot.fit">
    <img src="public/logo.png" alt="Plot" width="400" style="border-radius: 12px;">
  </a>
</p>

https://plot.fit

Visualise your Strava activities on Ordnance Survey maps.

Plan GPX routes on Ordnance Survey maps.

## Features

- **Activity maps** — View your Strava activities rendered on OS maps with route lines, photos, and stats
- **Screenshot export** — Download activity maps as high-quality JPEG images via headless Chromium
- **Route planner** — Plan walking and cycling routes on OS maps with path snapping, elevation profiles, and GPX export (no login required)

## Tech Stack

- [Next.js](https://nextjs.org) (App Router, TypeScript, Tailwind CSS v4)
- [OpenLayers](https://openlayers.org) for the route planner map
- [React Leaflet](https://react-leaflet.js.org) for activity map rendering
- [Puppeteer](https://pptr.dev) + [@sparticuz/chromium](https://github.com/nicolo-ribaudo/chropern) for server-side screenshot capture
- Strava API for activity data

Rewritten version of an older VueJS app: https://github.com/peterjcole/plot

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run lint` | Run ESLint |
