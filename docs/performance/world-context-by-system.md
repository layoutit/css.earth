# World context by system

Every page downloads the world context to draw the world around its body. The world holds 3,628 bodies in 2,127
systems. From Earth, all but the Solar System are a single star each: their planets fade out with distance and are never
drawn there. The context now loads the way the objects nest.

## What each page reads

A page never reads a list of the world's bodies. A body is found through its holder.

`pnpm prepare:world-context` writes the browser's copy ([summary.ts](../../packages/bake/src/world-context/summary.ts)):

- `world-context-summary.json`, which every page reads, holds the camera and frame facts, the Sun's own system in full,
  and every body that orbits nothing and the map opens by click (a featured star, a galaxy). It names no other body.
- `world-systems/<star id>.json` is one holder: a star with the bodies that orbit it, their named orbit centres and
  orbit-bank pins, served at `/world/systems/<id>.json`. A featured star is a body of the summary and its file holds its
  planets. A star the map draws as a plain dot, with no label, hover or click, is in its own file with them.
- A plain-dot star nothing orbits has no file: it is its own holder of one body, and its row travels in its object entry.
  The map draws a plain-dot star of the Milky Way as one of the galaxy's own dots
  ([packaged-stars](../../src/objects/milky-way-volume/source/packaged-stars/points.json)), and the ones in other
  galaxies from the world's two dot banks
  ([plain-star-dots.ts](../../packages/bake/src/world-context/plain-star-dots.ts), served at `/world/dots/<id>.bin`).
- `world-index.json` is the build's table of which holder has each body, with every body's place in the full context.
  Node tools, tests, the build and the deploy check read it; no page does.

The build tells each page and each object entry where its body is ([world-places.mts](../../site/world-places.mts)):
the page names its holder in its head (`<meta name="cssearth-world-holder">`) and asks for that file with the summary,
and `/objects/<id>/entry.json` carries `world: { holder, row? }`.

The application reads holders in [world-context-plan.mts](../../site/world-context-plan.mts):

- at startup, the summary and the page body's own holder (`/trappist-1b/` reads `trappist-1.json`)
- when navigation flies to a body the world does not hold: the body's entry names its holder, and the flight and its
  preview wait for it ([scene-transition.mts](../../site/scene/scene-transition.mts))
- when the camera comes within twice the distance at which a system's bodies are drawn
  ([world-approach.mts](../../site/world-approach.mts)): `/world/hosts.json`, read after the first view is interactive
  ([startup gate](startup-gate.md)), gives each holder star's place
- when a category pill is highlighted: the holders of the stars that carry its marked members

A holder joins the mounted world without remounting it. The world layer, the planner and the planner worker add its bodies
after their own, so every earlier body keeps its index (`extendWorldContext`, `addSystems`); one that arrives while the
camera coasts joins when the coast stops. The system tables (members, framing radius, satellite families, visibility)
are read from the bodies the world holds and follow it as holders arrive. Node tools, tests and the build read every
holder and rebuild the full context in its prepared order (`parseCompleteWorldContext`).

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

On 2026-10-02 the summary stopped listing other systems' bodies (4,125 bodies in the world, 684 in the summary, 2,553
holders, 713 of them files):

| What Earth's page downloads for the world context | Gzip |
| --- | --- |
| Before: `world-context-summary.json` with its list of 3,441 other bodies | 135,345 B |
| After, at startup: `world-context-summary.json` | 62,255 B |
| After, once the first view is interactive: `/world/hosts.json` | 12844 B |

The bundled world presentation also lost its table of every system's members and framing radii: 127 KB to 16 KB raw.
The four batches (572 KB raw after the first view) are gone: a system is read when it is flown to or approached.
