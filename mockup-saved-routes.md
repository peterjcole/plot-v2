# Saved Routes — interaction notes

Companion notes to `mockup-saved-routes-desktop.html` and `mockup-saved-routes-mobile.html`. Premium-only feature; non-premium users see none of this (existing single-scratchpad planner behaviour is unchanged for them).

**Important:** `mockup-saved-routes-mobile.html` deliberately does **not** reuse `mockup-h.html`'s mobile chrome (`.mob-sheet`, `.mob-ptb`, `.mob-hud` full-width bars, "NEW ROUTE" FAB). That design predates a rebuild to a floating-capsule language — `MobileHeader.tsx` (pill header), `PlannerToolbar.tsx` (floating toolbar pill), and the HUD block in `MapShell.tsx` (floating card, not edge-to-edge). The mobile mockup is grounded in those real components instead. `mockup-h.html` itself is unchanged by this work and is now stale on mobile — worth a note for whoever next touches it.

## Core flow: create → autosave → name

1. User places the first waypoint (desktop: click map; mobile: tap map with Add enabled, which is on by default).
2. A route record is created immediately and silently — "Untitled route". No dialog, nothing blocks the user from continuing to plot.
3. Every edit (waypoint add/move/remove, snap toggle, reverse) debounce-saves to the route record. The autosave chip shows the state: dim pulsing dot + "Saving…" while a write is in flight, solid green dot + "Saved" ~1s after the last edit settles (reuses the existing green "synced" dot convention from the status bar).
4. The route's start point is reverse-geocoded in the background to fill the location subtitle (e.g. "Pentland Hills · Edinburgh"). Shows "Locating…" until resolved; failure just leaves it blank, never blocks saving.
5. Naming is optional at every step. Click/tap the name to rename in place (desktop: click-to-edit with full-text selection, Enter/Esc; mobile: tap-to-edit with a checkmark confirm button since there's no Enter key).

## My Routes picker

- Desktop: a "My Routes" row sits directly under the Planner tab, always visible regardless of whether a route is loaded. Clicking it opens a flyout with the full list — clicking a row loads that route (replacing the current one, no confirm needed since the outgoing route already autosaved); a checkmark marks the currently-loaded route.
- Mobile: the HUD's route-identity row is the trigger; tapping it (or its chevron) opens a full "My Routes" floating sheet — same visual language as the existing activities bottom sheet.
- List rows show: name, distance, relative last-edited ("2d ago", "Just now"). "Untitled route" entries render dimmer to distinguish unnamed drafts from named routes at a glance.
- `+ New route` is always the last row/action — creates a fresh Untitled route immediately (same silent-create behaviour as the core flow) and switches to it.
- First-time premium users see an empty state: icon + "No saved routes yet" + "Start plotting to create one." No separate onboarding — the existing "Start New Route" CTA underneath does the same thing.

## Rename / duplicate / delete

- Reached via a route row's overflow ("⋯") button — not available for the currently-open route inline in the switcher trigger (that one renames via the header itself).
- Delete always requires an explicit confirm ("Delete 'X'? This can't be undone." + Cancel/Delete) — never a silent destructive tap, matching the existing `window.confirm('Clear the entire route?')` pattern in the planner toolbar, just implemented as a proper in-context card instead of a browser confirm.
- Duplicate creates a new named copy ("X (copy)") immediately in the library without switching to it, so the user can keep working on the original.
- Deleting the currently-open route falls back to loading the next-most-recent route, or creates a fresh Untitled route if the library is now empty.

## Undo / redo (durable, no dedicated UI)

- Per the product decision, the undo/redo stack persists per route and survives reload — but this is invisible plumbing, not a new UI surface. The existing Undo/Redo buttons in the toolbar just keep working when a route is reopened, including after a browser refresh or switching away and back via My Routes.
- No history timeline, no revision browser — explicitly out of scope for this feature.

## Autosave chip states

| State | Dot | Label |
|---|---|---|
| Idle / settled | solid green, glowing | "Saved" |
| Write in flight | dim grey, pulsing | "Saving…" |

Reuses the existing glowing-dot convention from the status bar's "synced" indicator — same color, same visual weight, so it reads as part of the established design language rather than a new pattern.

## Open questions for implementation (not blocking design sign-off)

- Exact reverse-geocoding source (Google Maps key already present in env, or reuse ORS behind `/api/route`) — see plan's Phase 2 notes.
- Debounce timing for autosave writes to the backend (existing local autosave debounce is 500ms; a network-backed save likely wants a longer debounce or a distinct "local instant, remote debounced" two-tier save).
- Whether `+ New route` should prompt to save/name the outgoing Untitled route, or just leave it in the library as-is (current design: leave it — autosave already covers it, no prompt needed).
