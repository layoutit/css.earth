# B9: Cassini infrared and ice maps

Owner: Moons. User-approved cohort: Tethys, Iapetus and Phoebe.
Branch: `feat/moons-cassini-ice-surfaces`.
Base: `80e19c51349f713c9a9a64b8ef1cbb78917f0fc7`, after merged B8 PR #87.
Status: six surfaces source-qualified, prepared and visually accepted; draft review with aggregate gates documented. See [implementation and source evidence](b9-cassini-ice-surfaces/README.md).

## Delivery

One PR delivers two new surface views on each of the three existing moons:
measured-channel false-color infrared imagery and continuum-relative water-ice
absorption. Each includes its source interpretation, prepared textures,
minimaps, legends, visible limitations and mounted browser evidence.

Geometry, retained scene topology, renderer, camera, navigation and shared shell
are fixed. Existing mesh paths and offline generation do not authorize geometry
changes. Only source interpretation, preparation and body-owned surface content
are in scope. Spectral strength is not ice percentage. Unknown regions remain
missing, and source-center transfer does not establish absolute pointing.

## Source qualification

Primary candidates are the calibrated original Cassini VIMS cubes and navigation
products in the Nantes archive, with PDS originals and interpretation documents:

- Tethys: <https://vims.univ-nantes.fr/flyby/TE>
- Iapetus: <https://vims.univ-nantes.fr/flyby/IA>
- Phoebe: <https://vims.univ-nantes.fr/flyby/PH>
- Data and calibration policy: <https://vims.univ-nantes.fr/about>

Qualify all three bodies before expensive preparation. Resolve actual product
bytes, layout, wavelengths, valid observations, coordinate conventions and
registration to the existing surfaces. Survey released corrected mosaics as
alternatives to individual observations. A metadata entry is not a qualified
map. Record rejected and unresolved candidates with concrete reasons.

## Delivery evidence

Require independent original-value and coordinate checks, reproducible source
restoration and output preparation, unchanged scene/geometry/old-image identity,
real Chrome DPR 1/2 and lighting-state review, existing interaction checks,
fresh image installation and measured payload costs. Record aggregate gates
separately from selected-body results.

Run substantial jobs one at a time and check current system conditions first.
Initial inspection found roughly 9 GiB free disk and unrelated CPU-heavy jobs;
begin with compact source metadata and reuse the existing isolated Moons
worktree. Do not clean unrelated files or terminate other tasks' processes.
