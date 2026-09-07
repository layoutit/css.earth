# Stellar neighbourhood

```text
stellar-neighbourhood/
├── object.json                  Physical frame and source/prepared pins
├── source/
│   ├── stars-hyg.gxct            All 109,389 locally vendored HYG rows
│   ├── stars.json                Hierarchy, atlas and photometry recipe
│   ├── provenance.json           Credits, epochs and modifications
│   ├── LICENSE.CC-BY-SA-4.0.md
│   └── sky/*.webp                Six pinned ESO photographic cube faces
└── prepared/
    ├── stars.json                Full reordered catalogue and spatial tree
    ├── point-atlas.png           32 colors × 32px compact point profiles
    └── diffuse-sky/*.webp        Offline low-pass photographic background
```

From the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:packages
pnpm build:preparation
node tools/objects/dist/prepare-stars.js src/objects/stellar-neighbourhood
pnpm test:preparation --universe
```

Every source row survives at its recorded Sun-origin ICRS Cartesian parsec
position. Node ranges partition the reordered catalogue; leaves contain at
most 32 rows. Runtime culling descends that tree, then displays exact star
rows, never centroid proxies. One real brightest apparent star per each of 96
all-sky cube cells receives the prepared alpha floor. The fixed 2,048 active
and 2,048 transition slots retain the complete dataset but may retire fainter
visible rows when the point budget is saturated; the recorded projected-error
statistic reports that condition. The full prepared dataset and image bank are
resident before navigation; no runtime geometry or imagery is baked.

The HYG Stellar Database by David Nash / Astronexus and its prepared derivatives
are licensed CC-BY-SA-4.0. ESO/S. Brunier's sky photograph is CC-BY-4.0. The diffuse
faces suppress compact points through low-pass filtering, not exact subtraction.
This is a local stellar neighbourhood (all rows within 991 pc), not a complete
Milky Way census. Catalogue astrometry is preserved without proper-motion
propagation to the navigation epoch. Source details and modifications remain
in the pinned provenance; reproduction requires no sibling checkout or network.

Derived hierarchy centres are published at 1e-10 parsec precision and aggregate
magnitudes at 1e-12 magnitude precision. Bounds are recomputed from those
published centres and rounded outward, preserving conservative containment.
This removes insignificant cross-CPU floating-point tails while keeping
relative aggregate luminosity error below 1e-12. Original catalogue positions
and magnitudes, photometry samples and all image bytes remain unchanged.
