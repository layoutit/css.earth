# Centaur validation

Chariklo and Bienor use published global shape constraints. These smooth ellipsoids are approximate shapes, with the standard grid marking unmapped surface detail. Chariklo's circular ring geometry uses a specific JWST occultation contact; gray display values and fixed opacity are schematic.

| Check | Evidence |
| --- | --- |
| Shape preparation | Each body: 5,040 authored faces simplified to 480 native PolyCSS `u` raster triangles. Independent literal semiaxes constrain prepared extents and ellipsoid residuals. |
| Ring preparation | Chariklo: two source-constrained annuli, 256 source quads combined into 16 retained image tiles. Aperture, gap, independent opacity and physical radii are checked. The extracted Haumea helper exactly matches the original 128-leaf geometry and image mapping. |
| Focused tests | Six tests pass: two independent body-shape checks and four annular preparation/compatibility tests. |
| Source/package closure | Chariklo verifies 17 source records; Bienor 16. Both prepared transport SHA-256 pins and asset inventories pass existing validators. Shadows and Orbit default off. |
| Orbit context | Existing JPL Horizons generator and independent vector fixtures at the repository epoch and ±30 days. Maximum epoch error is 0.000002055 km; maximum endpoint error is 820.390 km. The latter qualifies a bounded two-body approximation, not an encounter ephemeris. |
| Delivery | All 63 content-addressed image assets published, then independently downloaded through the standard setup implementation into an empty directory with one transfer at a time. Zero files reused; all 14,047,134 bytes match manifest sizes and SHA-256 hashes. |
| Shared navigation | Both densities preserve visible pixels of all 406 previous markers. The existing marker binding and object serializer refresh 408 transports without presentation recompilation; all non-marker runtime fields are asserted unchanged. |

Production build and browser evidence are pending. No complete all-body test-suite or physical-device performance claim is made. The browser qualification must inspect Chariklo's initial framing, zoomed physical ring/body scale, optional shadows and drag. Ring triangles are not included in the body's surface-picking structure; no separate ring-picking capability is claimed.

## Reproduce focused checks

```sh
node --test --test-concurrency=1 tools/objects/terrestrial-layers/rings.test.mjs tests/objects/unit/chariklo/source.test.mjs tests/objects/unit/bienor/source.test.mjs
node docs/centaur-population/verify.mjs
node docs/centaur-population/fresh-install.mjs
node docs/centaur-population/browser-check.mjs
CSSEARTH_CHROME_LOG_STDIO=1 node docs/lucy-targets/drag-trace.mjs http://127.0.0.1:4278 1 output/playwright/centaur-population/chariklo-drag chariklo
```

The fresh installer needs an empty destination. Browser checks use the coordinated production server at port 4278, one headless browser at a time. Preparation runs one body at a time with a 4 GiB Node heap limit and one image-processing worker.
