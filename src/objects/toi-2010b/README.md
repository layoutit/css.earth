# TOI-2010 b

## Sources

It is the only planet known around TOI-2010. Its orbit and size follow Mann et al. 2023's fit, the archive's default. This account was drafted from Mann et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 1.054 Jupiter radii from Mann et al. 2023 (2023AJ....166..239M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....166..239M/abstract): 75,352.6 km at 71,492 km per Jupiter radius. GM from the mass 1.286 Jupiter masses (Mann et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166..239M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166..239M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Mann et al. 2023 (2023AJ....166..239M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL_2023): P 141.834025 d Mann et al. 2023 (2023AJ....166..239M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL_2023): a/R* 109.8; Mann et al. 2023 (2023AJ....166..239M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL_2023): inclination 89.903 degrees Mann et al. 2023 (2023AJ....166..239M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL_2023): e 0.212 Mann et al. 2023 (2023AJ....166..239M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL_2023): omega 98.8 degrees Mann et al. 2023 (2023AJ....166..239M), via the NASA Exoplanet Archive ps table (pl_refname MANN_ET_AL_2023): transit mid-time 2458712.30168 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2010's measured colour (#fff4f4, the colour lens of toi-2010 (src/objects/toi-2010/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2010's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (81, 82, 83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2010b.json).


## Known problems

- **Orbit convention.** omega 98.8 degrees is taken as Mann et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.212) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
