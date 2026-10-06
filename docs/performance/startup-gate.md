# Startup gate

A body's page shows the body first. Until its detail is interactive, the world's background banks do not compete with it
for the connection. They start loading once the body is ready and the browser is idle, and then appear exactly as they
did before.

## What waits

These wait:

- the galaxy's catalogue dots (`milky-way/prepared/dots.bin`, `old-star-dots.bin` and `globular-clusters.bin`)
- the galaxies beyond and every other catalogue point bank
- the celestial sky cube's faces (`milky-way/prepared/sky/*.webp`)
- the galaxy's face-on backing image
- the other systems' bodies, in four batches ([world context by system](world-context-by-system.md))
- the hash groups of the body's texture levels next to the one shown (`/objects/<id>/asset-hashes/<group>.json`). Each
  level the body commits then reads its own neighbours' groups, so a zoom into a new level starts that level's images
  without first waiting for the group ([object-runtime.ts](../../packages/renderer/src/runtime/object-runtime.ts)).

What the first view needs does not wait:

- the world's plan, volume and point appearance, which the world mounts before the detail
  ([billboard-first startup](startup-billboard.md))
- the body's own textures
- the marker atlas
- the shell's images

## How it works

`packages/renderer/src/rendering/loading/startup-gate.ts` holds one gate per document. It keeps the gate on the window, so the
site's import and the renderer's built bundle share it.

1. The scene router holds the gate when a cold page's first view is a body. A focus or overview arrival shows the world
   first, so it never holds the gate, and its banks load at once.
2. The startup arrival releases the gate when it marks `cssearth:startup-detail-ready`
   ([startup-billboard.mts](../../site/scene/startup-billboard.mts)). An initial view without a prepared arrival releases it
   once it has arrived. A cancelled or failed one still releases it.
3. Released, the gate waits for `requestIdleCallback` (at most 1 s), then runs what waited, in order.

A loader asks the gate with `afterStartup(window, load)`. While the gate is open, `load` runs at once, so later loads
behave as before. A waiting sky face takes its image when the gate opens, if it is still in view. That is the same paint a
face makes when it turns into view, which the motion rules already allow during a coast
([coasting freezes membership](motion-freezes-membership.md)). The gate only delays when a fetch starts. Each loader
still mounts and reveals what it fetched.

## Measured

Earth page on the dev server, 2026-09-30, iPad Pro 11 landscape profile. Requests are counted against the
`cssearth:startup-detail-ready` mark, which is when the page is interactive. The counts are the same in Playwright WebKit
and Chrome.

| | Asset requests before interactive | After interactive |
| --- | --- | --- |
| Before | 63 (4,872 KB) | 0 |
| After | 59 (4,517 KB) | 4 (355 KB) |

Four requests moved, 354.6 KB in all:

- `dots.bin` (228.9 KB)
- `old-star-dots.bin` (69.5 KB)
- `globular-clusters.bin` (2.5 KB)
- the sky face `py.webp` (53.7 KB)

A portrait iPad draws no sky cube, so only the three dot banks move there (300.8 KB). Once the banks have loaded, the
settled world DOM and a screenshot match a run with the gate disabled exactly (0 differing pixels at threshold 0).

The shell's images are already lazy (`loading="lazy"`). In landscape, the sidebar shows the dataset thumbnails, the
default dataset's minimap and the Terra card in the first view, so they load with it, and the charts are never
requested. In portrait, the sheet below the fold holds the three chart SVGs and the Terra render and emblem (27.2 KB).
The browser's lazy-load margin starts them when the shell reveals, about 80 ms before the page is interactive.

`startup-gate.test.ts`, `catalogue-points.test.ts` and `sky/prepared-sky-startup.test.ts` in the renderer cover the
gate, the waiting dots and the waiting sky faces.
