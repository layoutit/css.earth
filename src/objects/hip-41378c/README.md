# HIP 41378 c

## Sources

It is one of 6 planets known around HIP 41378. Its orbit and size follow Lund et al. 2019's fit, the archive's default. This account was drafted from Grouffal et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.24444685 Jupiter radii from Grouffal et al. 2026 (2026arXiv260623103G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026arXiv260623103G/abstract): 17,476 km at 71,492 km per Jupiter radius. GM from the mass 0.01878372 Jupiter masses (Grouffal et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026arXiv260623103G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026arXiv260623103G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Grouffal et al. 2026 (2026arXiv260623103G), via the NASA Exoplanet Archive ps table (pl_refname GROUFFAL_ET_AL_2026): P 31.70591 d Grouffal et al. 2026 (2026arXiv260623103G), via the NASA Exoplanet Archive ps table (pl_refname GROUFFAL_ET_AL_2026): a/R* derived by Kepler's third law from its period 31.70591 d, stellar mass 1.22 and radius 1.3 solar units; Leonardi et al. 2025 (2025A&A...702A.211L), via the NASA Exoplanet Archive ps table (pl_refname LEONARDI_ET_AL_2025): inclination 88.462 degrees Leonardi et al. 2025 (2025A&A...702A.211L), via the NASA Exoplanet Archive ps table (pl_refname LEONARDI_ET_AL_2025): e 0.0678 Leonardi et al. 2025 (2025A&A...702A.211L), via the NASA Exoplanet Archive ps table (pl_refname LEONARDI_ET_AL_2025): omega 158 degrees Grouffal et al. 2026 (2026arXiv260623103G), via the NASA Exoplanet Archive ps table (pl_refname GROUFFAL_ET_AL_2026): transit mid-time 2457163.166 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 9 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hip-41378's measured colour (#f4f1ff, the colour lens of hip-41378 (src/objects/hip-41378/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HIP 41378's planets from above, from their hosted-orbit records. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hip-41378c.json).


## Known problems

- **Orbit convention.** omega 158 degrees is taken as Leonardi et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0678) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
