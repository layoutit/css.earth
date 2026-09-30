# TOI-3629 b

## Sources

It is the only planet known around TOI-3629. Its orbit and size follow Cañas et al. 2022's fit, the archive's default. This account was drafted from Cañas et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.74 Jupiter radii from Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....164...50C/abstract): 52,904.1 km at 71,492 km per Jupiter radius. GM from the mass 0.26 Jupiter masses (Cañas et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022AJ....164...50C), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022AJ....164...50C/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): P 3.9365578 d Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): a/R* 15.4; Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): inclination 89.1 degrees Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): e 0.05 Cañas et al. 2022 (2022AJ....164...50C), via the NASA Exoplanet Archive ps table (pl_refname CANAS_ET_AL_2022): omega -110 degrees, stored as 250 Hartman et al. 2023 (2023AJ....166..163H), via the NASA Exoplanet Archive ps table (pl_refname HARTMAN_ET_AL__2023): transit mid-time 2459662.10795 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-3629's measured colour (#ffc28a, the colour dataset of toi-3629 (src/objects/toi-3629/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-3629's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-3629b.json).


## Known problems

- **Orbit convention.** omega -110 degrees is taken as Cañas et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.05) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
