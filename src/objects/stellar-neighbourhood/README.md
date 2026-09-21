# Stellar neighbourhood

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

```text
stellar-neighbourhood/
├── object.json                  Physical frame and source/prepared pins
├── source/
│   ├── stars-hyg.gxct            All 109,389 locally vendored HYG rows
│   ├── stars.json                Hierarchy, atlas and photometry recipe
│   ├── provenance.json           Credits, epochs and modifications
│   └── LICENSE.CC-BY-SA-4.0.md
└── prepared/
    ├── stars.json                Manifest: frame, bank pin and layout, photometry, atlas, provenance
    ├── stars.bin                 Binary column bank: reordered catalogue rows and spatial tree
    └── point-atlas.png           32 colors × 32px compact point profiles
```

From the repository root:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build:tools
node tools/objects/dist/prepare-stars.js src/objects/stellar-neighbourhood
pnpm test:preparation --universe
```

Every source row survives. Eight explicit Hipparcos identities share the detailed
body astrometry at the fixed scene epoch; other rows keep their HYG J2000.0
Sun-origin ICRS Cartesian parsec positions. Node ranges partition the reordered catalogue; leaves contain at
most 32 rows. Runtime culling descends that tree, then displays exact star
rows, never centroid proxies. One real brightest apparent star per each of 96
all-sky cube cells receives the prepared alpha floor. The complete bank supports
the fixed 2,048 active and 2,048 transition slots used by specialist consumers.

The application does not load that complete bank. The manifest carries a
deterministic 2,048-row direct display sample: all 96 prepared sky-coverage
anchors, then the brightest remaining HYG rows by apparent magnitude at the
Sun. Positions and magnitudes include the explicit astrometry reconciliation
above; palette indices remain from the pinned catalogue. The browser projects the sample through
eight retained CSS `box-shadow` nodes. It fades in as the baked near-star cube
fades out, over the plain Milky Way image, and fades out when the completed
Milky Way volume contribution takes over.

The HYG Stellar Database by David Nash / Astronexus and its prepared derivatives
are licensed CC-BY-SA-4.0. This is a local stellar neighbourhood (all rows within
991 pc), not a complete Milky Way census. The eight reconciled stars retain HYG apparent magnitudes at the Sun: absolute
magnitudes are adjusted for the adopted distances. Coordinates use the existing
float32 parsec bank, so agreement with float64 body positions is limited by that
quantization. Remaining catalogue rows are not propagated. The retained GXCT
metadata incorrectly describes the coordinate epoch as J1991.25; the corrected
source provenance and prepared catalogue metadata identify J2000.0. The
reconciliation receipt retains the original epoch description for traceability. Source details and
modifications remain in the pinned provenance; reproduction requires no sibling
checkout or network.

Derived hierarchy centres are published at 1e-10 parsec precision and aggregate
magnitudes at 1e-12 magnitude precision. Bounds are recomputed from those
published centres and rounded outward, preserving conservative containment.
This removes insignificant cross-CPU floating-point tails while keeping
relative aggregate luminosity error below 1e-12. Hierarchy aggregates are
computed from the float32 source magnitudes, before transport quantization.

## Prepared transport

`object.json` pins the manifest. The manifest pins `stars.bin` by byte length
and SHA-256; the loader checks both before it decodes a byte, then checks the
bank header, column directory, counts, indices and value ranges.

| Field | Storage | Error against the prepared value |
| --- | --- | --- |
| Star position | float32 × 3 | 0: the HYG column is float32 |
| Star absolute magnitude | int16, decoded as float32(q / 1000) | ≤ 5e-4 mag declared; 3.6e-4 mag measured on 2 of 109,389 rows, 0 on the rest |
| Star source row, color, coverage anchors | uint32, uint8, uint32 index list | 0 |
| Star names | `[index, name]` pairs in the manifest | 0 |
| Node centre, radius, magnitude | float64 | 0 |
| Node color, range, children | uint8, uint32, uint8 count + uint32 list | 0 |

Positions stay float32. The camera can approach any star, so a fixed-point
position would eventually move visibly; int32 fixed point would cost the same
four bytes as the lossless float32 value.

The magnitude bound is derived from the point-field runtime. Luminance and
radius are interpolated between 0.05 mag photometry samples. The drawn size is
2·haloRadii·radius, and the atlas core edge is a smoothstep. Ordinary stars below
`IMPERCEPTIBLE_LUMINANCE` (0.5/255) are hidden, and coverage anchors are
clamped. Over that chain, a 5e-4 mag error changes a composited pixel's alpha
by at most 1.09e-3, which is 0.55 of the 0.5/255 display threshold. Preparation
fails if either the measured error or this display effect exceeds its bound.
It then decodes the written bank with the runtime decoder and compares every
field with the prepared rows. The manifest records each field's bound, measured
error and display effect in `bank.quantization`.

The bank ships uncompressed. The Vite dev server sends `application/octet-stream`
without `Content-Encoding`, and gzip at rest would not be byte-reproducible
across zlib builds. Hosts that compress octet streams reduce it further (table below).

## Evidence

Measured for manifest `ce772fbc…` and bank `2d2587f5…` against the previous
single JSON document `b1a7107c…`.

| Transport | Bytes | gzip -9 | brotli 11 |
| --- | ---: | ---: | ---: |
| Previous `stars.json` | 23,559,279 | 4,851,789 | 3,355,993 |
| Manifest `stars.json` | 55,778 | 8,584 | 6,550 |
| Bank `stars.bin` | 2,799,000 | 2,330,683 | 2,146,773 |

| Complete loader (verify, parse, decode) | Previous | Bank |
| --- | ---: | ---: |
| Node 24, median of 7 | 154.1 ms | 30.0 ms |
| Headless Chrome, median of 9 | 131.2 ms | 23.1 ms |

- Decoded rows equal the previous JSON rows except the two off-grid magnitudes.
  All 13,334 nodes are bit-identical. Everything else in the manifest is unchanged.
- Rebuilding from the checked-in inputs reproduces both files byte for byte.
- Screenshots at 1440×900 (the solar-system overview, 1 pc and 100 pc) show
  0 changed pixels (pixelmatch, threshold 0) between the previous and the bank
  transport. Two loads of the previous transport also differ by 0 pixels.
- The minimap selects the same 2,048 catalogue stars in the same order.
