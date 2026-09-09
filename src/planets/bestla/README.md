# Bestla

Lightcurve-constrained minimum-elongation illustration through the generic object contract. Published south-ecliptic pole latitude approximately -85 ± 15 degrees and sidereal period are useful; do not invent a pole longitude or native convex mesh. See [SOURCE.md](SOURCE.md) for the distinct physical estimates and display assumptions.

The radius table, neutral no-data image, title source and shape-derived context image are checked in. The normal acquisition plan restores pinned ESO/font inputs. Runtime installation requires the prepared assets and manifest produced by the shared pipeline.

After orbit inputs and the preparation tools are available:

```sh
node tools/objects/dist/operations.js acquire bestla
node tools/objects/dist/prepare-authored.js bestla --write
```

The B1 source-only authoring script is docs/moons/b1-preparation/author-saturn-packages.mjs. It copies no prepared scene or other body’s orbital validation.
