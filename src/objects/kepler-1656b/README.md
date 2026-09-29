# Kepler-1656 b

## Sources

It is one of 2 planets known around Kepler-1656. Its orbit and size follow Angelo et al. 2022's fit, the archive's default. This account was drafted from Angelo et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.40806565 Jupiter radii from Fulton & Petigura 2018 (2018AJ....156..264F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2018AJ....156..264F/abstract): 29,173.4 km at 71,492 km per Jupiter radius. GM from the mass 0.15 Jupiter masses (Angelo et al. 2022, the mass the NASA Exoplanet Archive's composite table adopts (2022AJ....163..227A), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2022AJ....163..227A/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): P 31.57865226 d Angelo et al. 2022 (2022AJ....163..227A), via the NASA Exoplanet Archive ps table (pl_refname ANGELO_ET_AL__2022): a/R* derived from its semi-major axis 0.1974 au and stellar radius 1.1 solar radii; Brady et al. 2018 (2018AJ....156..147B), via the NASA Exoplanet Archive ps table (pl_refname BRADY_ET_AL__2018): inclination 89.31 degrees Angelo et al. 2022 (2022AJ....163..227A), via the NASA Exoplanet Archive ps table (pl_refname ANGELO_ET_AL__2022): e 0.838 Angelo et al. 2022 (2022AJ....163..227A), via the NASA Exoplanet Archive ps table (pl_refname ANGELO_ET_AL__2022): omega 52.8 degrees Holczer et al. 2016 (2016ApJS..225....9H), via the NASA Exoplanet Archive ps table (pl_refname HOLCZER_ET_AL__2016): transit mid-time 2454978.62703 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by kepler-1656's measured colour (#fff0eb, the colour lens of kepler-1656 (src/objects/kepler-1656/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of Kepler-1656's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (74, 80, 81), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/kepler-1656b.json).


## Known problems

- **Orbit convention.** omega 52.8 degrees is taken as Angelo et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.838) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
