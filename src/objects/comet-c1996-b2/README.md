# C/1996 B2 Hyakutake

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

Hyakutake passed just 0.10 AU from Earth in March 1996. Its close approach made it a striking sight despite its much smaller nucleus than Hale–Bopp’s.

One **Shape approximation** dataset shows a sphere of radius 1.25 km, the midpoint of Harmon et al.'s 2-3 km diameter range (Harmon et al. (1997), Science 278, 1921). The whole surface carries the missing-imagery grid. Shadows defaults off.

## Sources

| Source | What it supplies |
| --- | --- |
| [Shape parameters](source/shape/model.json) | Radar nucleus diameter range (2-3 km) from [Harmon et al. (1997), Science 278, 1921](https://doi.org/10.1126/science.278.5345.1921), tessellated as a smooth ellipsoid. |
| [JPL elements](source/reference/horizons-elements.txt) and [independent vectors](source/reference/horizons-vectors.txt) | Heliocentric ICRF position at JD2461286.5, 3 September 2026 TT. |

[Selection, alternatives and assumptions](source/reference/source-record.json) explain the sources and factsheet derivations. [Credits and reuse terms](NOTICE.md) accompany the pinned inputs.

[Investigation ledger](investigations.json) records source choices, failed trials and conditions for retrying. Earlier findings were carried forward from the linked records; this is not a fresh archive search.

## Evidence

Run of 2026-09-16 (this version): `node tools/objects/dist/prepare-authored.js comet-c1996-b2 --write` prepared the package from the ellipsoid parameters. `node --test tests/objects/unit/comet-radius-models.test.mts` passes for all twenty radius-model comets: the prepared 800-triangle surface is closed, matches the published radius and elongation in its own anchor table and in `packages/astronomy`, carries the missing-imagery grid with Shadows off, and the source manifest verifies. The earlier source, delivery and browser reports tested the retired Celestia mesh and were removed with it.

## Known problems

The ellipsoid is a smooth approximation at the midpoint of Harmon et al.'s 2-3 km diameter range, not a measured nucleus reconstruction. Unresolved; the midpoint of the radar diameter range is displayed as a sphere. No surface imagery, measured pole, rotation period, current phase, tail or coma is represented. The fixed attitude is illustrative.

Position is fixed at the explorer's epoch; nearby conics are placement approximations, not long-term ephemerides or outgassing predictions. Horizons TDB differs from the stated TT epoch by less than 2 ms.

<details>
<summary>Shape preparation</summary>

The 1.25 km midpoint radius scales a subdivided octahedron with the stated axis ratios as a volume-equivalent ellipsoid, in metres, reduced offline to 800 display triangles. The camera uses the same radius. Geometry, grid texels, optional shadows and lighting are prepared once; the browser performs no runtime mesh work.

</details>
