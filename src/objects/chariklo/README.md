# Chariklo

## Sources

| Source | What the view uses |
| --- | --- |
| [Morgado et al. (2021), Table 6](https://doi.org/10.1051/0004-6361/202141543) | Smooth ellipsoid fitted jointly to eleven stellar occultations in 2013–2020: semiaxes 143.8, 135.2 and 99.1 km. These are model estimates. |
| [Santos-Sanz et al. (2025), Table 1](https://arxiv.org/html/2510.06366v1#S0.T1) | Two rings approximated from the first contact of the 18 October 2022 JWST NIRCam F150W2 occultation. |

## Evidence

- [Recorded checks](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/VALIDATION.md): shape and rings, [17 source records](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/source-validation.json), and [fresh image installation](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/fresh-install.json) for both Centaurs.
- [Headless Chrome checks](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/browser-validation.json) cover both bodies at 1440 × 900 CSS pixels, DPR 1/2, after integration of `3badfb535`. Later PR #89 checks cover data integration. [The drag report](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/evidence/chariklo-drag.json) retains its earlier build identity and local raw-trace path/hash.

## Known problems

- The grid marks an unmapped surface. The ellipsoid resolves no terrain, and integrated JWST spectra provide no mapped colors.
- Rings are fixed circular annuli. Gray and opacity are schematic; there is no reflected-light, scattering or ring-shadow model.
- Spin alignment with the ring normal is assumed; spin direction is unknown, and display longitude and phase are arbitrary. Orbit context is fixed at 2026-09-03 TT.
- Settings is hidden; optional Shadows were checked through the checkbox event. These reports do not establish a full-suite pass or physical-device performance.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods

<details>
<summary>Shape, ring and orbit interpretation</summary>

### Shape, scale and orientation

Chariklo is a Centaur moving among the giant planets. The full approximation dimensions are 287.6 × 270.4 × 198.2 km. Full axes are halved once; their semiaxes’ geometric mean sets the rendering reference radius. This is not an independently observed radius or the volume of a convex reconstruction. The asymmetric formal axis uncertainties remain in [measurements.json](source/measurements.json).

The ICRS ring-plane normal is RA 151.03° ± 0.14°, Dec +41.81° ± 0.07°. The adopted positive-declination pole follows the paper’s arbitrary choice. The photometric period, 7.004 ± 0.036 h, is an approximate spin rate, not a precise sidereal rotational ephemeris. The numerical extraction was checked on 2026-09-09.

### Rings

The selected contact gives C1R radius 385.9 km and radial width 7.04 km, and C2R radius 400.3 km and radial width 1.009 km. [The ring record](source/rings/occultation-2022.json) retains the uncertainties, normal occultation opacity and its explicitly schematic use as constant display alpha. C2R has broad uncertainties, and ring properties vary with longitude, wavelength and epoch. Its 2021 equivalent width of 0.117 km is opacity times radial width, not a geometric width. No unsampled longitude structure is added.

Preparation uses the existing annular geometry helper and coplanar raster compiler: 256 source quads become 16 retained image tiles, preserving the central aperture and gap. Ring triangles are absent from the body surface-picking structure; no separate ring picking is provided. [The batch ring account](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/README.md#chariklos-rings) explains this processing and its source choices.

### Orbit

This fixed-date orbit is not a real-time trajectory or surface attitude. JPL Horizons command `10199;` supplies osculating ICRF elements. The existing astronomy generator approximates TDB as TT at the scene epoch, a difference below 2 ms. [Independent vector comparisons](https://github.com/layoutit/cssEarth/blob/cc01831f595e0b73ab6699d6235cf7b466f76cfc/docs/centaur-population/orbit-errors.json) sample the epoch and ±30 days; their finite residuals do not establish accuracy at every date.

### Reproduction

The [table tool](../../../tools/objects/source-authoring/README.md) reproduces the
pinned radii from [measurements](source/measurements.json). The
[navigation recipe](source/preparation/navigation.json) records the context image.

The [terrestrial recipe](source/preparation/terrestrial.json) prepares geometry, texture and lighting for retained native PolyCSS raster triangles: 5,040 authored faces simplify to 480 body triangles. Use the [shared preparation commands](../../../.agents/skills/celestial-skill/references/implementation-map.md#commands-and-test-routing) to rebuild the scene.

</details>
