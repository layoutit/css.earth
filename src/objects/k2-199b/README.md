# K2-199 b

## Sources

It is one of 2 planets known around K2-199. Its orbit and size follow Akana Murphy et al. 2021's fit, the archive's default. The introduction is generated from Akana Murphy et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 0.15434053 Jupiter radii from Akana Murphy et al. 2021 (2021AJ....162..294A), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....162..294A/abstract): 11,034.1 km at 71,492 km per Jupiter radius. GM from the mass 0.02170983 Jupiter masses (Akana Murphy et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021AJ....162..294A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021AJ....162..294A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Akana Murphy et al. 2021 (2021AJ....162..294A), via the NASA Exoplanet Archive ps table (pl_refname AKANA_MURPHY_ET_AL__2021): P 3.2253993 d Akana Murphy et al. 2021 (2021AJ....162..294A), via the NASA Exoplanet Archive ps table (pl_refname AKANA_MURPHY_ET_AL__2021): a/R* 12.07; Akana Murphy et al. 2021 (2021AJ....162..294A), via the NASA Exoplanet Archive ps table (pl_refname AKANA_MURPHY_ET_AL__2021): inclination 88.8 degrees Akana Murphy et al. 2021 (2021AJ....162..294A), via the NASA Exoplanet Archive ps table (pl_refname AKANA_MURPHY_ET_AL__2021): e 0.02 Akana Murphy et al. 2021 (2021AJ....162..294A), via the NASA Exoplanet Archive ps table (pl_refname AKANA_MURPHY_ET_AL__2021): omega 170 degrees Akana Murphy et al. 2021 (2021AJ....162..294A), via the NASA Exoplanet Archive ps table (pl_refname AKANA_MURPHY_ET_AL__2021): transit mid-time 2457218.73733 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-199's measured colour (#ffd0b2, the colour dataset of k2-199 (src/objects/k2-199/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-199's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-199b.json).

## Known problems

- **Orbit convention.** omega 170 degrees is taken as Akana Murphy et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.02) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
