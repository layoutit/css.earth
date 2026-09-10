# Celestia comet intake

Adds the 20 core-catalog comets absent from cssEarth. The existing Halley, Encke
and Borrelly packages retain their scientific reconstructions. All other existing
comets also keep their surfaces and source data.

The upstream catalog is pinned to CelestiaContent commit
`1993a082ee6307c0df7fdc0828eb117a0e8e9958`. The original SSC bytes, GPL license,
generic mesh descriptions, and hashes are in `source/`. Each body retains its
complete catalog excerpt and the shared header, including authors and citations.
The catalog and derived size parameters retain GPL-2.0-or-later; independent
importer and preparation code follow cssEarth's MIT license.

## Representation

The imported information is **identity, native Celestia mesh and approximate catalog radius**. Celestia
assigns 19 of these objects its shared `asteroid.cms` and one `roughsphere.cms`.
Those are generic procedural illustrations, not observations of these nuclei.
cssEarth compiles Celestia’s original SphereMesh and Perlin code, exports its mesh, normalizes it as Celestia does, then uniformly scales it. It uses the
existing missing-imagery grid over the whole surface and explicitly labels the
view **Illustrative nucleus**. The dataset label is **Celestia**.

Radius sets a display scale, not a new measurement. We do not import Celestia's
colors, stock texture, albedo, density, mass, or assumed rotation. Shadows and
Orbit default off. The fixed orientation is illustrative. Existing measured
shape packages are never overwritten. No tail or coma is fabricated.

Each factsheet has two facts and a brief explanation. Catalog diameter is twice
the upstream radius, rounded to two significant figures. Closest solar distance
is the perihelion of the JPL osculating orbit at the scene epoch; it is not a
prediction of the next encounter. The underlying values and derivations remain
in each source record. Catalog sizes carry substantial and uneven uncertainties;
the approximate label is deliberate, and the catalog is not ranked above later
scientific measurements.

## Reproduce

Run commands from the repository root with the project's supported Node runtime:

The native mesh exports are checked in. To reproduce them from Celestia's
original C++ code, follow the [native exporter instructions](native/README.md).

1. `node tools/objects/celestia-comets/acquire-orbits.mts` obtains and pins the
   JPL records, writing `output/celestia-comets/intake.json`. Responses beside the
   packages preserve the exact queries. Requests are sequential.
2. `node tools/objects/celestia-comets/scaffold.mts` authors the reviewed new
   source packages. It refuses to overwrite an existing descriptor. This is an
   intake operation, not a command for rebuilding existing packages.
3. `node tools/objects/celestia-comets/initialize.mts` prepares title outlines,
   grid-backed context images and source hashes through shared preparers.
4. `node tools/objects/celestia-comets/integrate.mts` registers each body's
   descriptor and individual astronomy record, then regenerates the combined
   astronomy exports and object catalogue.
5. Follow the [body contributor guide](../../../src/planets/README.md) to prepare
   and assemble the packages, publish pinned runtime assets, and verify delivery.

The checked-in source packages are the maintained authoring boundary after
intake. Normal rebuilds use the generic authored-object command. No SSC parsing,
mesh generation, source lookup or astronomy derivation occurs in the browser.

## Position and validation

JPL queries use geometric, heliocentric ICRF positions in kilometres at
JD2461286.5 (3 September 2026 TT). Query time is TDB, approximated as TT with a
difference below 2 ms. Independent vectors at the epoch and ±30 days test the
local conic approximation. This is a fixed-epoch explorer, not a long-term comet
ephemeris. Near-parabolic and hyperbolic cases must preserve their actual conic
and frame; no eccentricity clamping or fabricated closing segment is allowed.

Four imported bodies have heliocentric eccentricity above one at this epoch:
Arend–Roland, Siding Spring 2013, Bernardinelli–Bernstein, and Tsuchinshan–ATLAS.
This does not by itself establish an interstellar origin. Shared open-orbit
support is coordinated with the asteroids owner's ʻOumuamua work.
