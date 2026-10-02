# K2-167 b

## Sources

It is the only planet known around K2-167. Its orbit and size follow Thygesen et al. 2023's fit, the archive's default. The introduction is generated from Thygesen et al. 2023's published values; the sections below are the data's own.

**Size and mass.** Radius 0.211 Jupiter radii from Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract): 15,084.8 km at 71,492 km per Jupiter radius. GM from the mass 0.02045129 Jupiter masses (Bonomo et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023A&A...677A..33B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023A&A...677A..33B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ikwut-Ukwa et al. 2020 (2020AJ....160..209I), via the NASA Exoplanet Archive ps table (pl_refname IKWUT_UKWA_ET_AL__2020): P 9.97857 d Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): a/R* 13.37; Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): inclination 86.8 degrees Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): e 0.48 Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): omega 140 degrees Ikwut-Ukwa et al. 2020 (2020AJ....160..209I), via the NASA Exoplanet Archive ps table (pl_refname IKWUT_UKWA_ET_AL__2020): transit mid-time 2457349.1397 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 12 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Color.** No image or measured color exists. The neutral gray is lit by k2-167's measured color (#f9f4ff, the color dataset of k2-167 (src/objects/k2-167/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-167's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (42, 92, 96), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-167b.json).

## Known problems

- **Orbit convention.** omega 140 degrees is taken as Thygesen et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.48) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
