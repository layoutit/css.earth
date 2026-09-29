# NGTS-35 b

## Sources

It is the only planet known around NGTS-35. Its orbit and size follow Kendall et al. 2026's fit, the archive's default. This account was drafted from Kendall et al. 2026's values; the sections below are the data's own.

**Size and mass.** Radius 0.97243454 Jupiter radii from Kendall et al. 2026 (2026MNRAS.547f2189K), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2026MNRAS.547f2189K/abstract): 69,521.3 km at 71,492 km per Jupiter radius. GM from the mass 0.47824548 Jupiter masses (Kendall et al. 2026, the mass the NASA Exoplanet Archive's composite table adopts (2026MNRAS.547f2189K), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2026MNRAS.547f2189K/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 731.9966539026 d Kendall et al. 2026 (2026MNRAS.547f2189K), via the NASA Exoplanet Archive ps table (pl_refname KENDALL_ET_AL_2026): a/R* derived from its semi-major axis 0.16 au and stellar radius 0.753 solar radii; Kendall et al. 2026 (2026MNRAS.547f2189K), via the NASA Exoplanet Archive ps table (pl_refname KENDALL_ET_AL_2026): inclination 88.816 degrees Kendall et al. 2026 (2026MNRAS.547f2189K), via the NASA Exoplanet Archive ps table (pl_refname KENDALL_ET_AL_2026): e 0.192 Kendall et al. 2026 (2026MNRAS.547f2189K), via the NASA Exoplanet Archive ps table (pl_refname KENDALL_ET_AL_2026): omega 38 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459283.547474 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by ngts-35's measured colour (#ffd6b9, the colour lens of ngts-35 (src/objects/ngts-35/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of NGTS-35's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (90, 100, 101), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ngts-35b.json).


## Known problems

- **Orbit convention.** omega 38 degrees is taken as Kendall et al. 2026 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.192) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
