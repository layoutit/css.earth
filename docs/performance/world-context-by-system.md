# World context by the object tree

Every page downloads the world context to draw the world around its body. The world holds 4,144 bodies. From Earth, all
but the Solar System's are far: another star's planets fade out with distance and are never drawn there. The context
loads the way the objects nest.

## What each page reads

Every object is inside exactly one other object (`parent` in its object.json; the Observable Universe is the root,
[object-tree.ts](../../packages/objects/src/registry/object-tree.ts)). A page never reads a list of the world's bodies:
a body's row is in the file of the object it is inside.

`pnpm prepare:world-context` writes the browser's copy ([summary.ts](../../packages/bake/src/world-context/summary.ts)),
by one rule the bake and the build share ([world-holders.ts](../../packages/objects/src/prepared-data/world-holders.ts)):

- `src/objects/observable-universe/prepared/world.json`, which every page reads, is the root object's: the camera, frame
  and sky facts and the Sun, at the frame's origin. It lists no other body.
- `src/objects/<object id>/prepared/members.json` is one object's file, in its own package: the bodies inside it, their
  named orbit centres and orbit-bank pins, served at `/world/systems/<id>.json`. A body with a system of its own is drawn
  as that system, so its row is in the file of the object its system is inside: the Earth's is in the Solar System's, the
  Moon's in the Earth system's, TRAPPIST-1's in the Milky Way's and its planets' in the TRAPPIST-1 system's.
- `src/objects/<object id>/prepared/orbits/<body id>.bin` is the orbit path of one body of that file, beside the file
  that pins it, served at `/world/orbits/<body id>.bin`. The planner worker reads it when a frame first draws that orbit.
- A star the map draws as a plain dot, with no label, hover or click, is not in its parent's file. One with planets is in
  its own system's file with them; one with nothing round it has no file, and its row travels in its object entry. The
  map draws a plain-dot star of the Milky Way as one of the galaxy's own dots
  ([packaged-stars](../../src/objects/milky-way-volume/source/packaged-stars/points.json)), and one of another galaxy as a
  dot of that galaxy's own bank, `src/objects/<galaxy id>/prepared/plain-stars.bin`
  ([plain-star-dots.ts](../../packages/bake/src/world-context/plain-star-dots.ts), served at `/world/dots/<galaxy id>.bin`).
  An asteroid drawn as a plain dot is a dot of `catalogue-asteroids`, whose file has its row.
- `src/objects/<object id>/prepared/places.json` is, per object, where each of its children's systems that is read on
  approach is: its host's place, rounded to 1e12 m, and the range its orbits are authored to. Served at
  `/world/places/<id>.json`.
- `src/objects/observable-universe/prepared/world-index.json` is the build's own: every body's place in the full context,
  every object with a file from the root of the tree down, and the rows object entries carry. It names no holder. Node
  tools, tests, the build and the deploy check read it; no page does.

The bake computes every body in one full context, `src/objects/sun/prepared/world-context.json`, in the Sun's package: the
frame is the Sun's and the Sun's scene is framed from it. Node tools read it; no page does. It is the only world file there.

A file is read by every page when a body in it is drawn from anywhere: one that orbits nothing or the Sun and is no
plain dot (the Solar System's planets, the Milky Way's featured stars, the galaxies and clusters, a featured star of
another galaxy), or when it has places. On 2026-10-03 that is 22 files. The build serves them as one response, each file
whole and named by its object (`/world/anywhere.json`): as 22 responses they were 32.1 KB gzipped, as one 26.1 KB.

The build tells each page and each object entry which files it needs ([world-places.mts](../../site/world-places.mts)),
root first, so an orbit's parent is placed before it: the page names its own in its head
(`<meta name="cssearth-world-files">`), and `/objects/<id>/entry.json` carries `world: { files, row? }`.

The application reads files in [world-context-plan.mts](../../site/world-context-plan.mts):

- at startup, the summary, the files every page reads, and the files of the page's own object and of the objects it is
  inside that are not among those (`/earth/` reads `earth-system.json`, `/trappist-1b/` reads `trappist-1-system.json`)
- when navigation flies to a body the world does not hold: the body's entry names its files, and the flight and its
  preview wait for them ([scene-transition.mts](../../site/scene/scene-transition.mts))
- when the camera comes within twice the distance at which a system's bodies are drawn
  ([world-approach.mts](../../site/world-approach.mts)): the places of every file read, asked for after the first view is
  interactive ([startup gate](startup-gate.md)), give each system's place
- when a category pill is highlighted: the files that have its marked members

A file joins the mounted world without remounting it. The world layer, the planner and the planner worker add its bodies
after their own, so every earlier body keeps its index (`extendWorldContext`, `addSystems`); one that arrives while the
camera coasts joins when the coast stops. The system tables (members, framing radius, satellite families, visibility)
are read from the bodies the world holds and follow it as files arrive. Node tools, tests and the build read every
file and rebuild the full context in its prepared order (`parseCompleteWorldContext`).

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

On 2026-10-03 the files followed the object tree (4,144 bodies; 751 files, 22 of them read by every page; 1,840 rows in
object entries). The summary of the day before held 269 bodies; the files every page reads now hold 291: the same, 19
objects added since (15 far destinations, the four SH0ES galaxies) and three bodies that share a file with one drawn
from anywhere.

| What Earth's page downloads for the world context at startup | Gzip |
| --- | --- |
| One summary of those 291 bodies, as the files were before (computed from the same rows) | 26,283 B |
| `world.json` (no bodies) | 1,269 B |
| `/world/anywhere.json` (22 files in one response) | 26,100 B |
| `earth-system.json` (the page's own) | 484 B |

`/world/hosts.json` (12.8 KB gzipped after the first view) is gone: the Milky Way's `places.json` is 12.6 KB and the
Solar System's, the Clouds' and M31's are under 0.3 KB each, asked for after the first view as before.
