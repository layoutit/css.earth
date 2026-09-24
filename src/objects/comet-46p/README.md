# 46P/Wirtanen

The navigation snapshot uses the same retained shape and viewing direction, with prepared full-phase lighting (35% ambient, 65% diffuse). Its neutral gray material remains a display convention without observed surface detail. The snapshot recipe is recorded in [the source manifest](source/manifest.json); the selected-body geometry and scientific assets are unchanged.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Wirtanen was Rosetta’s planned destination before a launch delay changed the mission’s target to 67P. Its small nucleus returns to the inner Solar System roughly every five years.

One **Shape approximation** dataset shows an ellipsoid at the published effective nucleus radius of 0.6 km (Boehnhardt et al. (2002), A&A 387, 1107). The whole surface carries the missing-imagery grid. Shadows defaults off.

## Sources

| Source | What it supplies |
| --- | --- |
| [Shape parameters](source/shape/model.json) | Published effective nucleus radius and shape statement from [Boehnhardt et al. (2002), A&A 387, 1107](https://doi.org/10.1051/0004-6361:20020494), tessellated as a smooth ellipsoid. |
| [JPL elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric ICRF position at JD2461286.5, 3 September 2026 TT. |

[Selection, alternatives and assumptions](source/reference/source-record.json) explain the sources and factsheet derivations. [Credits and reuse terms](NOTICE.md) accompany the pinned inputs.

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

Run of 2026-09-16 (this version): `node tools/objects/dist/prepare-authored.js comet-46p --write` prepared the package from the ellipsoid parameters. `node --test tests/objects/unit/comet-radius-models.test.mts` passes for all twenty radius-model comets: the prepared 800-triangle surface is closed, matches the published radius and elongation in its own anchor table and in `packages/astronomy`, carries the missing-imagery grid with Shadows off, and the source manifest verifies. The earlier source, delivery and browser reports tested the retired Celestia mesh and were removed with it.

## Known problems

The ellipsoid is a smooth approximation at a published effective radius, not a measured nucleus reconstruction. Lightcurves give an axis ratio of at least 1.4 and a period of 6 to 7.5 hours; the minimum elongation is displayed. No surface imagery, measured pole, rotation period, current phase, tail or coma is represented. The fixed attitude is illustrative.

Position is fixed at the explorer's epoch; nearby conics are placement approximations, not long-term ephemerides or outgassing predictions. Horizons TDB differs from the stated TT epoch by less than 2 ms.

<details>
<summary>Shape preparation</summary>

The published effective radius scales a subdivided octahedron with the stated axis ratios as a volume-equivalent ellipsoid, in metres, reduced offline to 800 display triangles. The camera uses the same radius. Geometry, grid texels, optional shadows and lighting are prepared once; the browser performs no runtime mesh work.

</details>
