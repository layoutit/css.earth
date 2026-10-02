# WASP-140 b

## Sources

It is the only planet known around WASP-140. Its orbit and size follow Alexoudi 2022's fit, the archive's default. The introduction is generated from Alexoudi 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 1.27 Jupiter radii from Alexoudi 2022 (2022AN....34324012A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AN....34324012A/abstract): 90,794.8 km at 71,492 km per Jupiter radius. GM from the mass 2.44 Jupiter masses (Hellier et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017MNRAS.465.3693H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017MNRAS.465.3693H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 2.23598448 d Alexoudi 2022 (2022AN....34324012A), via the NASA Exoplanet Archive ps table (pl_refname ALEXOUDI_2022): a/R* 8.58; Alexoudi 2022 (2022AN....34324012A), via the NASA Exoplanet Archive ps table (pl_refname ALEXOUDI_2022): inclination 84.3 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): e 0.047 Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): omega 356 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458533.440604 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by wasp-140's measured color (#ffe9da, the color dataset of wasp-140 (src/objects/wasp-140/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-140's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (5, 31, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-140b.json).

## Known problems

- **Orbit convention.** omega 356 degrees is taken as Kokori et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.047) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
