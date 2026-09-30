# TOI-3714 b

## Sources

It is the only planet known around TOI-3714. Its orbit and size follow Cañas et al. 2022's fit, the archive's default. This account was drafted from Cañas et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 1.01 Jupiter radii from Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...50C/abstract): 72,206.9 km at 71,492 km per Jupiter radius. GM from the mass 0.7 Jupiter masses (Cañas et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022AJ....164...50C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022AJ....164...50C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): P 2.15484802 d Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): a/R* 11.5; Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): inclination 88.7 degrees Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): e 0.03 Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): omega 100 degrees Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): transit mid-time 2459687.36524 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-3714's measured colour (#ffc587, the colour dataset of toi-3714 (src/objects/toi-3714/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-3714's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (59, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-3714b.json).


## Known problems

- **Orbit convention.** omega 100 degrees is taken as Cañas et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.03) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
