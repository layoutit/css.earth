# World context by system

Every page downloads the world context to draw the world around its body. The world holds 3,628 bodies in 2,127
systems. From Earth, all but the Solar System are a single star each: their planets fade out with distance and are never
drawn there. The context now loads the way the objects nest.

## What each page reads

`pnpm prepare:world-context` writes the browser's copy in two parts
([summary.ts](../../packages/bake/src/world-context/summary.ts)):

- `world-context-summary.json`, which every page reads, holds the camera and frame facts, the Sun's own system in full,
  and every body that orbits nothing: each other system's star, drawn as one point. It lists the bodies of every other
  system (`deferred`) with only what navigation, search and world visibility need before that system loads: name,
  classification, discovery record, its star and its place among the world's bodies.
- `world-systems/<star id>.json` holds one other system's bodies, named orbit centres and orbit-bank pins. The build
  serves each one at `/world/systems/<id>.json` and serves them in four batches at `/world/systems/batch-<n>.json`.
- A star the map draws as a plain dot, with no label, hover or click, and that nothing orbits, is not a body of the
  summary: 1,840 of its 3,202 on 2026-10-02, when the summary went from 230 KB to 168 KB compressed. The summary lists
  it like a deferred body, as its own host. The map draws these stars from two dot banks
  ([plain-star-dots.ts](../../packages/bake/src/world-context/plain-star-dots.ts), served at `/world/dots/<id>.bin`),
  and a star's own row travels in its object entry (`/objects/<id>/entry.json`), read when the star is opened by search
  or on its own page. The bake keeps the rows in `world-stars.json` for the build, Node tools and the deploy check; no
  page reads that file.

The application reads them in [world-context-plan.mts](../../site/world-context-plan.mts):

- at startup, the summary, and also the page body's own system when it is not the Sun's (`/trappist-1b/` reads
  `trappist-1.json`)
- when navigation flies to a body of a system not yet read: the flight and its preview wait for that system
  ([scene-transition.mts](../../site/scene/scene-transition.mts))
- after the first view is interactive ([startup gate](startup-gate.md)): the four batches, which bring in every other
  system

A system joins the mounted world without remounting it. The world layer, the planner and the planner worker add its bodies
after their own, so every earlier body keeps its index (`extendWorldContext`, `addSystems`). Node tools, tests and the
build read every file and rebuild the full context in its prepared order (`parseCompleteWorldContext`). A system's
framing radius, which the overview's exit distance needs before that system loads, is prepared with the world
presentation (`systemFramingRadii`).

Each file also writes once what many bodies repeat. Bodies are one column per field. Each body names its system and
discovery record by their place in a table. A billboard at its page's own address and the common size, focal length and
arrival distance leaves those out. An orbit leaves out a centre equal to its parent's position, and says `lod: true` when
its detail levels share its bounds. The parsers put each body back exactly as before: with every file read, the parsed
world matches the earlier summary body for body.

## Measured

Prepared on 2026-09-30 from the same world (3,628 bodies), gzip level 9:

| What Earth's page downloads for the world context | Raw | Gzip |
| --- | --- | --- |
| Before: `world-context-summary.json` | 2,298,692 B | 335,268 B |
| After, at startup: `world-context-summary.json` | 818,124 B | 202,517 B |
| After, once the first view is interactive: four batches | 572,091 B | |

`/` and `/earth/` read the same summary and no system file. The startup summary holds 2,709 bodies: the Sun's 544 and
2,165 stars. Positions are the largest remaining part (79 KB of the 203 KB gzipped). Each system file is small:
`trappist-1.json` is 2.7 KB, 0.7 KB gzipped.

On the dev server the Earth page mounts its world with the Sun and the summary's 2,709 bodies. The four batches start
about 3 s after load, and the world then holds all 3,628 bodies with no console errors. A flight from Earth to TRAPPIST-1 b, with the batches held back,
reads `trappist-1.json` and arrives with its system drawn.
