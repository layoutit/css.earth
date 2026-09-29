# TOI-2295 b

## Sources

It is one of 2 planets known around TOI-2295. Its orbit and size follow Heidari et al. 2025's fit, the archive's default. This account was drafted from Heidari et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 1.47 Jupiter radii from Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...694A..36H/abstract): 105,093.2 km at 71,492 km per Jupiter radius. GM from the mass 0.875 Jupiter masses (Heidari et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...694A..36H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...694A..36H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 60.06632 d Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): a/R* derived from its semi-major axis 0.1992 au and stellar radius 1.459 solar radii; Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): inclination 88.16 degrees Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): e 0.334 Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): omega -39.2 degrees, stored as 320.8 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458713.454918 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2295's measured colour (#fff0eb, the colour lens of toi-2295 (src/objects/toi-2295/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2295's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (81, 82, 86), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2295b.json).


## Known problems

- **Orbit convention.** omega -39.2 degrees is taken as Heidari et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.334) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
