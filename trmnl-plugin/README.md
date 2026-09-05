# plot — TRMNL plugin

Shows the route, date, distance, and elevation gain of your most recent long
run/ride on a TRMNL e-paper device, backed by `/api/trmnl` and
`/api/trmnl/map` in the plot app.

## How it works

TRMNL polls `GET /api/trmnl` (with an `Authorization: Bearer` header) on a
schedule. That endpoint returns JSON — the activity's stats, formatted, plus
a URL for the map image:

```json
{
  "activity_name": "Long Sunday Loop",
  "activity_type": "Run",
  "date": "5 Sep 2026",
  "distance": "21.53",
  "elevation": "367",
  "duration": "2:50:50",
  "pace": "7:56",
  "image_url": "https://<host>/api/trmnl/map?token=...&v=19960305682"
}
```

`src/full.liquid` sets `image_url` as the **background image** of the
screen's `view` and leaves `title_bar` completely untouched — that's what
makes it "native": it's the framework's own default title_bar chrome
(dithered fill, its own font/spacing) sitting over a full-bleed map, not a
custom overlay we built. `image_url` points at `/api/trmnl/map` — a
greyscale PNG of the route already tone-mapped and quantised to TRMNL's
2-bit (4-grey) palette, with the route drawn in pure black (the *only*
pure-black pixels in the image) over a white-cased line, rendered at full
800x480 device resolution so nothing gets upscaled. That image endpoint
uses its own `?token=` query param rather than a header, because TRMNL's
renderer fetches the background image without custom headers.

`settings.yml` ships with `no_screen_padding: 'yes'` (TRMNL calls this
"full bleed" in the UI) so the map reaches every edge of the screen; the
`m--4` (16px) margin on `title_bar` in the template is what keeps the bar
itself from then hugging the screen edge too.

## Set the device to 4 grays

The base map only reads well with a real tonal range — at 1-bit it has to
be dithered, which is noisy at this resolution. Set the **palette per
playlist item**, not device-wide, so your other plugins keep 1-bit's faster
refresh:

Playlist → this plugin's item → **⋯** → **Presentation** → **Color
Palette** → **4 grays (2-bit)**.

(Background: [Understanding color palettes](https://help.trmnl.com/en/articles/12985974-understanding-color-palettes).)

## Setup — manual (no CLI required)

1. In the TRMNL dashboard: **Plugins → Private Plugin → New**, strategy
   **Polling**.
2. **Polling URL**: `https://<your-plot-deployment>/api/trmnl`
3. **Polling Verb**: `GET`
4. **Polling Headers**: `Authorization=Bearer <TRMNL_BEARER_TOKEN>`
5. **Refresh interval**: 60 minutes is plenty — the underlying activity
   data changes at most a few times a day, and TRMNL skips regenerating
   the screen when the polled payload is unchanged.
6. Paste the contents of `src/full.liquid` into the markup editor (and
   `src/half_horizontal.liquid` into the mashup markup, if you want it in a
   half-screen playlist slot too).
7. Add the plugin to a playlist, then set its palette to 4 grays as above.

## Setup — CLI (`trmnlp`)

```bash
gem install trmnl_preview   # or: docker run --pull always -p 4567:4567 -v "$(pwd):/plugin" trmnl/trmnlp serve
cd trmnl-plugin
trmnlp login                # saves an API key to ~/.config/trmnlp/config.yml
trmnlp push                 # creates the plugin from src/settings.yml + src/*.liquid
```

After the first push, set the real **Polling URL** and **Polling Headers**
in the TRMNL UI (step 2–4 above) — `src/settings.yml` ships with both
blank deliberately, so the bearer token never ends up committed to this
repo. Don't `trmnlp push` again until you've either left those fields
alone or re-synced them with `trmnlp pull` first, or you'll blank them out
on the live plugin.

### Local preview

```bash
trmnlp serve   # http://localhost:4567 — hot-reloads src/*.liquid
```

`trmnlp serve` calls whatever's in `src/settings.yml`'s `polling_url` — so
to preview against your real data, temporarily paste your deployment URL
and bearer header into `src/settings.yml` locally (don't commit that
change), or run `trmnlp pull` once after configuring the plugin in the UI.

`trmnlp build --png --width 800 --height 480 --color-depth 2` renders a
static PNG of the current template without a device, useful for a quick
look at layout changes.

### Updating an existing plugin

```bash
trmnlp login
trmnlp clone plot <plugin-id>
cd plot
# ...edit src/*.liquid...
trmnlp push
```

## Environment variables (plot app)

Set both in `.env.local` for development and in Vercel for production —
neither is in `.env.example` since this repo doesn't keep one; treat this
README as the source of truth for them.

| Variable | Used by | Notes |
|---|---|---|
| `TRMNL_BEARER_TOKEN` | `/api/trmnl` | Compared against the `Authorization: Bearer` header TRMNL sends when polling. Generate with e.g. `openssl rand -hex 32`. |
| `TRMNL_IMAGE_TOKEN` | `/api/trmnl/map` | Compared against `?token=` on the map image URL. Separate from the bearer token since it travels in a URL (visible in logs, the device's request history) rather than a header. |

## Optional: IP allowlisting

If you'd rather not rely on the token alone, TRMNL publishes the IPs it
polls from at <https://trmnl.com/api/ips> — allowlist them in front of
`/api/trmnl` and `/api/trmnl/map` if your hosting supports it.

## Tuning the map image

`/api/trmnl/map` accepts query params if you want to try variations without
redeploying:

| Param | Default | Notes |
|---|---|---|
| `w`, `h` | `800`, `480` | Full device resolution, rendered natively (no CSS scaling, no upscaling of the stitched map — a route bbox is rarely 800x480-shaped, so the shorter axis is left with margin rather than blown up past its native tile resolution to fill the frame). |
| `minDistance` | `10000` | Minimum activity distance (metres) to qualify as "the long run". |
| `levels` | `4` | `2` renders the 1-bit Floyd–Steinberg fallback instead — noisier, but usable if you leave the device on 1-bit. |
| `hillshade` | `0` | `1` adds shaded relief. Off by default — Landranger contours already carry most of the terrain read, and shading eats into the four grey levels' headroom. |
| `lw` | `14` | Total route line footprint in px. The route is drawn hollow (see below) so this is outer-edge to outer-edge, not a fill width. |
| `casing` | `2` | Thickness of each of the two casing strokes, in px. The core is `lw - 2*casing`. |
| `dither` | `1` | `0` leaves the core fully transparent instead of stippled (see below). |
| `spacing` | `7` | Spacing in px between dots in the core's dither stipple. |
| `dot` | `2` | Size in px of each dot (a square, not a circle — see below). |

The route line is a **hollow outline** — two thin black casing strokes around
a light dot-stipple core — rather than a solid line, so the OS Landranger
paths and tracks the route followed stay visible underneath the trace instead
of being blotted out by it. Pure black is reserved for the route:
`toEpaperTone` never tone-maps the base map to level 0, so the casing is the
only pure-black ink on screen and survives the final grey-level snap even at
2px.

The core's dots are squares on whole-pixel boundaries, not circles — a
sub-pixel-radius circle anti-aliases to a value the final hard threshold snap
(`quantiseGreyPng`) rounds away to paper white, so the dither vanished
entirely until this was pixel-aligned. The dots are a fixed screen tied to
canvas coordinates (not to the route path), so as the route curves the same
dot grid just shows through wherever the stroke happens to be.
