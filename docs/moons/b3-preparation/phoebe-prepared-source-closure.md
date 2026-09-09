# Phoebe B3 source and prepared closure

The paired 2023 geometry, relative-albedo and quality products are prepared successfully. All 42 source records and all 44 installed runtime assets match their pinned bytes. The runtime assets total 77,280,172 bytes. This is source/package closure; browser, full application gates and publication remain separately qualified.

| Mounted view | Scientific meaning | Missing canonical preview pixels |
|---|---|---:|
| Relative albedo (default) | Normalized SPC brightness; not natural color or quantitative geometric albedo. At least five contributing images and a valid source maplet are required. | 478,208 |
| Radial height | Q512 radius minus a 106.5 km sphere, in km; same support policy. Not independent altimetry. | 478,208 |
| Maplet resolution | Finest contributing maplet spacing, 125–1500 m/vertex. Actual 99999 sentinel is withheld; GSD is not height accuracy. | 429,696 |
| Image count | All source counts 0–87, including zero. Counts do not establish independent viewing angles. | 0 |

These are counts on a 2880 × 1440 equirectangular grid, not surface-area fractions. They agree exactly with independently counted one-degree quality cells at 64 display pixels per source cell. Every native value in all four cubes was checked, plus six independent low/zero-count, sentinel, threshold and mapped-region fixtures.

The retained 3,500-face shape is the smallest tested regularized candidate passing the source-distance criterion. It is closed, consistently wound and one component (Euler characteristic 2). Its 14,000 sampled closest-source distances have maximum 1,178.282 m, 95th percentile 468.869 m and RMS 240.811 m. The solver's distinct estimate is 889.795 m. These are rendering approximation checks; one-way samples are not a full Hausdorff bound or scientific uncertainty. Q512 map detail remains finer than the Q128-derived display geometry.

The first bake was retained as a failed attempt: a 16-column atlas exceeded WebP height. The successful normal retry uses 32 columns, giving 4096 × 14080 atlases with the same 128-pixel face cells and unchanged geometry. Every installed atlas reports nearest sampling and has verified dimensions/hashes. The preparation-only albedo map's decoded RGB matches the source-derived RGB hash exactly. The regenerated context repeats bit-for-bit and matches both manifest and navigation pins. The earlier monochrome source remains a linked, acquisition-pinned reference outside the mounted roster; its registration to the shifted 2023 shape is unqualified.

Validation: the three focused Phoebe tests passed, normal acquisition verified all source records, and the ordinary preparation command completed with exit 0 and runtime true. No extra heap/runtime flags were used. The companion JSON records exact pins, source limits and retained attempt logs. No browser or capture was launched by this lane.
