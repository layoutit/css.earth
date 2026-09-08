# Fornjot

Lightcurve-constrained minimum-elongation illustration through the generic object contract. Very weak period determination; author table allows 7 or 9.5 hours. Do not animate a unique measured period. See [SOURCE.md](SOURCE.md) for the distinct physical estimates and display assumptions.

The radius table, neutral no-data image, title source and shape-derived context image are checked in. The normal acquisition plan restores pinned ESO/font inputs. Runtime installation requires the prepared assets and manifest produced by the shared pipeline.

After orbit inputs and the preparation tools are available:

```sh
node tools/objects/dist/operations.js acquire fornjot
node tools/objects/dist/prepare-authored.js fornjot --write
```

The B1 source-only authoring script is docs/moons/b1-preparation/author-saturn-packages.mjs. It copies no prepared scene or other body’s orbital validation.
