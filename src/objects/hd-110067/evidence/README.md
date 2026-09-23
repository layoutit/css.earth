# HD 110067 evidence — 2026-09-23

These results apply to the source records, recipes and presentation CSS committed with this evidence. The shared Telescope reader is the `eso-sdp-spectrum@1` implementation in commit `eca0259c7159eae652792f4babce3aba9792db3c`.

## Numerical and source checks

The [Astropy 8.0.1 / NumPy 2.5.3 reference](color-reference.json) independently integrates the native ESPRESSO spectrum. Its linear sRGB channels agree with the shared preparer to 5e-16, and both encode [255, 218, 212]. All 401 visible 1 nm bins contain samples; no missing band is interpolated. This validates integration of the same observation, not the archive's flux calibration.

The focused astronomy checks passed 26 tests, covering catalogue registration, stellar placement and hosted-orbit propagation. The system membership, radius, limb-source and planet-scaffold checks passed 13 tests. The seven prepared runtime packages passed 14 checks, including toggle commits without replacement of retained nodes. The star-scaffold and package-consistency checks passed six tests. Edited TypeScript passed scoped ESLint.

CI exposed a preparation-order defect: restoring the Sun's published context after generating the current catalogue replaced it with a version missing the seven new bodies. The universe lanes now rerun the existing world-context preparation after restoration. Locally, restoring those three published files and regenerating them passed both the catalogue-membership check and the full-context/summary/binary-orbit consistency check (two selected tests).

The shared source validator verified the seven manifests and public assets. The published source catalogue compiled with the new facts and citations. [Delivery evidence](delivery.json) records a fresh restore of all 312 inventoried files (50,027,919 bytes), with zero reuse or skipped files. Every downloaded file passed its inventory size and SHA-256 check.

## Inspected browser views

Chromium, 1280 × 900 CSS pixels, with `ASSET_ORIGIN=https://earth-assets.lowpoly.cc`. The local preview disabled file watching and eager dependency discovery, and used a 1 GiB Node heap cap. No full-site build or full source acquisition was run locally.

- [Star](star.png): measured spectral colour and the published ATLAS9 limb model.
- [Six-planet overview](system.png): six orbit tracks, their labels and host. Following the system breadcrumb retained one active scene.
- [Planet b, flood lighting](planet.png) and [directional shadows after dragging](planet-shadows.png): both prepared lighting modes render; toggling and dragging preserve the same surface nodes.
- [WASP-43](wasp-43-limb.png): a check of the shared stellar plate alignment correction using an existing package. The star styles no longer multiply the already-fitted silhouette by the legacy geometry scale.

The remaining five new planet routes each mounted exactly one scene. The captured route run had no page errors or failed requests; all observed new-planet R2 responses returned 200. The planet scaffold now supplies the CSS that displays its prepared lighting plane and fits the 460 px lighting bank to its 496 px reference disc.

These are appearance, interaction and delivery checks, not a matched photographic oracle or an N-body resonance calculation. Unresolved planet colours remain neutral gray; the stellar limb profile is modeled. Linear 2023 periods do not predict current transits. Repository-wide performance and source qualification were not rerun.
