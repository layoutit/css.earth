# Bienor

## Sources

| Source | What the view uses |
| --- | --- |
| [Rizos et al. (2024), A&A 689, A82](https://doi.org/10.1051/0004-6361/202450833) | Smooth ellipsoid fitted to stellar-occultation chords and rotational light curves: semiaxes 127 ± 5, 55 ± 4 and 45 ± 4 km. |
| Fernández-Valenzuela et al. (2017), assessed by the [2024 study](https://doi.org/10.1051/0004-6361/202450833) | Prograde ecliptic pole, supported over 22 years; the refined photometric period is 9.1736 ± 0.0002 h. |

## Evidence

- [Recorded checks](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/VALIDATION.md): shape, [16 source records](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/source-validation.json), and [fresh image installation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/fresh-install.json) for both Centaurs.
- [Headless Chrome checks](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/browser-validation.json) cover both bodies at 1440 × 900 CSS pixels, DPR 1/2, after integration of `3badfb535`. Later PR #89 checks cover data integration; [default](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/evidence/bienor-default.png) and [close](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/evidence/bienor-close.png) captures retain their earlier build identities.

## Known problems

- The grid marks an unmapped surface. The smooth ellipsoid resolves no terrain or mapped albedo and leaves light-curve asymmetry unexplained; shape, albedo and companion alternatives remain unresolved.
- Display longitude and absolute phase are arbitrary. Orbit context is fixed at 2026-09-03 TT.
- Settings is hidden; optional Shadows were checked through the checkbox event. These reports do not establish a full-suite pass or physical-device performance.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Shape, orientation and orbit interpretation</summary>

### Shape, scale and orientation

Bienor is an elongated Centaur. The full approximation dimensions are 254 × 110 × 90 km. Full axes are halved once; their semiaxes’ geometric mean sets the rendering reference radius. This is not an independently observed radius or the volume of a convex reconstruction. Formal axis uncertainties are retained where supplied by the source.

The adopted prograde ecliptic pole is longitude 35° ± 8°, latitude +50° ± 3°. Ecliptic J2000 coordinates are converted to ICRF using the preparation recipe. The 2024 study uses its refined period to compute rotational phase; cssEarth’s arbitrary display phase is a separate choice. [measurements.json](source/measurements.json) records the radius-table formula, pole conversion and numerical extraction checked on 2026-09-09.

### Source survey

The reference ellipsoid does not reproduce all observed light-curve asymmetry. The paper’s irregular-shape, contact-binary, albedo and satellite scenarios are alternatives rather than uniquely measured geometry. No ring or satellite is displayed because the selected occultations do not establish their geometry. Integrated light curves and spectra are not surface maps.

[The source survey](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/README.md#source-survey-dispositions) records the selections and alternatives. Published papers are cited, not relicensed or bundled. Credits and reuse terms for the authored approximation, ESO panorama, Inter font and HYG metadata are in [NOTICE.md](NOTICE.md) and the manifest.

### Orbit

This fixed-date orbit is not a real-time trajectory or surface attitude. JPL Horizons command `54598;` supplies osculating ICRF elements. The existing astronomy generator approximates TDB as TT at the scene epoch, a difference below 2 ms. [Independent vector comparisons](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/orbit-errors.json) sample the epoch and ±30 days; their finite residuals do not establish accuracy at every date.

### Reproduction

The [table tool](../../../tools/objects/source-authoring/README.md) reproduces the
pinned radii from [measurements](source/measurements.json). The
[navigation recipe](source/preparation/navigation.json) records the context image.

The [terrestrial recipe](source/preparation/terrestrial.json) prepares geometry, texture and lighting for retained native PolyCSS raster triangles: 5,040 authored faces simplify to 480 body triangles. Use the [shared preparation commands](../../../.agents/skills/celestial-skill/references/implementation-map.md#commands-and-test-routing) to rebuild the scene.

</details>
