# C/1995 O1 Hale–Bopp

The navigation snapshot uses the same retained shape and viewing direction, with prepared full-phase lighting (35% ambient, 65% diffuse). Its neutral gray material remains a display convention without observed surface detail. The snapshot recipe is recorded in [the source manifest](source/manifest.json); the selected-body geometry and scientific assets are unchanged.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Hale–Bopp remained visible to the naked eye for about 18 months in 1996 and 1997. Its unusually large nucleus helped make it one of the most memorable comets of the twentieth century.

One **Shape approximation** dataset shows an ellipsoid at the published effective nucleus radius of 37 km (Szabó et al. (2012), ApJ 761, 8). The whole surface carries the missing-imagery grid. Shadows defaults off.

## Sources

| Source | What it supplies |
| --- | --- |
| [Shape parameters](source/shape/model.json) | Published effective nucleus radius and shape statement from [Szabó et al. (2012), ApJ 761, 8](https://doi.org/10.1088/0004-637X/761/1/8), tessellated as a smooth ellipsoid. |
| [JPL elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric ICRF position at JD2461286.5, 3 September 2026 TT. |
| [JPL elements at the 1997 perihelion](source/reference/horizons-elements-1997.txt) | Osculating elements on 1997 April 1 TDB (solution JPL 226). The "Closest to Sun" fact, 0.914 AU, is the QR of this passage. The 2026 osculating value (0.925 AU) describes the current orbit, not the passage Hale-Bopp is known for. |

[Selection, alternatives and assumptions](source/reference/source-record.json) explain the sources and factsheet derivations. [Credits and reuse terms](NOTICE.md) accompany the pinned inputs.

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

Run of 2026-09-16 (this version): `node tools/objects/dist/prepare-authored.js comet-c1995-o1 --write` prepared the package from the ellipsoid parameters. `node --test tests/objects/unit/comet-radius-models.test.mts` passes for all twenty radius-model comets: the prepared 800-triangle surface is closed, matches the published radius and elongation in its own anchor table and in `packages/astronomy`, carries the missing-imagery grid with Shadows off, and the source manifest verifies. The earlier source, delivery and browser reports tested the retired Celestia mesh and were removed with it.

## Known problems

The ellipsoid is a smooth approximation at a published effective radius, not a measured nucleus reconstruction. A sphere; Fernández (2002) gives 30 ± 10 km by another method. The 11.35 hour period is not displayed. No surface imagery, measured pole, rotation period, current phase, tail or coma is represented. The fixed attitude is illustrative.

Position is fixed at the explorer's epoch; nearby conics are placement approximations, not long-term ephemerides or outgassing predictions. Horizons TDB differs from the stated TT epoch by less than 2 ms.

<details>
<summary>Shape preparation</summary>

The published effective radius scales a subdivided octahedron with the stated axis ratios as a volume-equivalent ellipsoid, in metres, reduced offline to 800 display triangles. The camera uses the same radius. Geometry, grid texels, optional shadows and lighting are prepared once; the browser performs no runtime mesh work.

</details>
