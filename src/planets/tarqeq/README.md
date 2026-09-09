# Tarqeq

Lightcurve-constrained minimum-elongation illustration through the generic object contract. Long 76.13-hour period and q=1.32 give a distinct bounded model opportunity. See [SOURCE.md](SOURCE.md) for the distinct physical estimates and display assumptions.

The radius table, neutral no-data image, title source and shape-derived context image are checked in. The normal acquisition plan restores pinned ESO/font inputs. Runtime installation requires the prepared assets and manifest produced by the shared pipeline.

After orbit inputs and the preparation tools are available:

```sh
node tools/objects/dist/operations.js acquire tarqeq
node tools/objects/dist/prepare-authored.js tarqeq --write
```

The B1 source-only authoring script is docs/moons/b1-preparation/author-saturn-packages.mjs. It copies no prepared scene or other body’s orbital validation.
