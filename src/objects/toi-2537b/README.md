# TOI-2537 b

## Sources

It is one of 2 planets known around TOI-2537. Its orbit and size follow Heidari et al. 2025's fit, the archive's default. This account was drafted from Heidari et al. 2025's values; the sections below are the data's own.

**Size and mass.** Radius 1.004 Jupiter radii from Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...694A..36H/abstract): 71,778 km at 71,492 km per Jupiter radius. GM from the mass 1.307 Jupiter masses (Heidari et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...694A..36H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...694A..36H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 94.09979541079 d Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): a/R* derived from its semi-major axis 0.3715 au and stellar radius 0.771 solar radii; Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): inclination 89.592 degrees Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): e 0.364 Heidari et al. 2025 (2025A&A...694A..36H), via the NASA Exoplanet Archive ps table (pl_refname HEIDARI_ET_AL_2025): omega 75.2 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459475.467243 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2537's measured colour (#ffd1ad, the colour dataset of toi-2537 (src/objects/toi-2537/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2537's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (44, 70, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2537b.json).


## Known problems

- **Orbit convention.** omega 75.2 degrees is taken as Heidari et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.364) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
