# TOI-1468 c

## Sources

It is one of 2 planets known around TOI-1468. Its orbit and size follow Meier Valdés et al. 2025's fit, the archive's default. This account was drafted from Meier Valdés et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 0.18966934 Jupiter radii from Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...698A..68M/abstract): 13,559.8 km at 71,492 km per Jupiter radius. GM from the mass 0.01290004 Jupiter masses (Meier Valdés et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...698A..68M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...698A..68M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 15.5324384892 d Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): a/R* 49.8; Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): inclination 89.22 degrees Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): e 0.111 Meier Valdés et al. 2025 (2025A&A...698A..68M), via the NASA Exoplanet Archive ps table (pl_refname MEIER_VALDES_ET_AL_2025): omega 130 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459450.356025 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1468's measured colour (#ffca85, the colour lens of toi-1468 (src/objects/toi-1468/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1468's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (43, 57, 84), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1468c.json).


## Known problems

- **Orbit convention.** omega 130 degrees is taken as Meier Valdés et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.111) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
