# HD 77946 b

## Sources

It is the only planet known around HD 77946. Its orbit and size follow MacDougall et al. 2023's fit, the archive's default. This account was drafted from Polanski et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.25840541 Jupiter radii from Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract): 18,473.9 km at 71,492 km per Jupiter radius. GM from the mass 0.03429524 Jupiter masses (Polanski et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024ApJS..272...32P), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024ApJS..272...32P/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Palethorpe et al. 2024 (2024MNRAS.529.3323P), via the NASA Exoplanet Archive ps table (pl_refname PALETHORPE_ET_AL_2024): P 6.527282 d Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): a/R* derived from its semi-major axis 0.073 au and stellar radius 1.3174 solar radii; Palethorpe et al. 2024 (2024MNRAS.529.3323P), via the NASA Exoplanet Archive ps table (pl_refname PALETHORPE_ET_AL_2024): inclination 87.79 degrees Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): e 0.211 Polanski et al. 2024 (2024ApJS..272...32P), via the NASA Exoplanet Archive ps table (pl_refname POLANSKI_ET_AL__2024): omega 9.2 degrees Palethorpe et al. 2024 (2024MNRAS.529.3323P), via the NASA Exoplanet Archive ps table (pl_refname PALETHORPE_ET_AL_2024): transit mid-time 2459587.474 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 5 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-77946's measured colour (#fff7fd, the colour lens of hd-77946 (src/objects/hd-77946/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 77946's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (21, 47), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-77946b.json).


## Known problems

- **Orbit convention.** omega 9.2 degrees is taken as Polanski et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.211) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
