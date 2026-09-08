# Hati

Lightcurve-constrained minimum-elongation illustration through the generic object contract. 5.45 ± 0.04 hours used from Table 3 and body page; overview wording 5.42 is inconsistent. Useful elongation floor. See [SOURCE.md](SOURCE.md) for the distinct physical estimates and display assumptions.

The radius table, neutral no-data image, title source and shape-derived context image are checked in. The normal acquisition plan restores pinned ESO/font inputs. Runtime installation requires the prepared assets and manifest produced by the shared pipeline.

After orbit inputs and the preparation tools are available:

```sh
node tools/objects/dist/operations.js acquire hati
node tools/objects/dist/prepare-authored.js hati --write
```

The B1 source-only authoring script is docs/moons/b1-preparation/author-saturn-packages.mjs. It copies no prepared scene or other body’s orbital validation.
