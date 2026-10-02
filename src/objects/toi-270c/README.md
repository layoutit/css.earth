# TOI-270 c

## Sources

It is one of 3 planets known around TOI-270. Its orbit and size follow Kaye et al. 2022's fit, the archive's default. The introduction is generated from Kaye et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 0.20786903 Jupiter radii from Kaye et al. 2022 (2022MNRAS.510.5464K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022MNRAS.510.5464K/abstract): 14,861 km at 71,492 km per Jupiter radius. GM from the mass 0.01950738 Jupiter masses (Kaye et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022MNRAS.510.5464K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022MNRAS.510.5464K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 5.66047732509 d Kaye et al. 2022 (2022MNRAS.510.5464K), via the NASA Exoplanet Archive ps table (pl_refname KAYE_ET_AL__2022): a/R* 25.569; Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): inclination 89.53 degrees Van Eylen et al. 2021 (2021MNRAS.507.2154V), via the NASA Exoplanet Archive ps table (pl_refname VAN_EYLEN_ET_AL__2021): e 0.027 Van Eylen et al. 2021 (2021MNRAS.507.2154V), via the NASA Exoplanet Archive ps table (pl_refname VAN_EYLEN_ET_AL__2021): omega 10 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460982.004741 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by toi-270's measured color (#ffc384, the color dataset of toi-270 (src/objects/toi-270/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-270's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (32, 97, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-270c.json).

## Known problems

- **Orbit convention.** omega 10 degrees is taken as Van Eylen et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.027) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
