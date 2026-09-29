# HD 106315 b

## Sources

It is one of 2 planets known around HD 106315. Its orbit and size follow Barros et al. 2017's fit, the archive's default. This account was drafted from Barros et al. 2017's values; the sections below are the data's own.

**Size and mass.** Radius 0.21768222 Jupiter radii from Barros et al. 2017 (2017A&A...608A..25B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...608A..25B/abstract): 15,562.5 km at 71,492 km per Jupiter radius. GM from the mass 0.03964383 Jupiter masses (Barros et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017A&A...608A..25B), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017A&A...608A..25B/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 9.58028883839 d Barros et al. 2017 (2017A&A...608A..25B), via the NASA Exoplanet Archive ps table (pl_refname BARROS_ET_AL__2017): a/R* 15.07; Barros et al. 2017 (2017A&A...608A..25B), via the NASA Exoplanet Archive ps table (pl_refname BARROS_ET_AL__2017): inclination 87.54 degrees Barros et al. 2017 (2017A&A...608A..25B), via the NASA Exoplanet Archive ps table (pl_refname BARROS_ET_AL__2017): e 0.093 Barros et al. 2017 (2017A&A...608A..25B), via the NASA Exoplanet Archive ps table (pl_refname BARROS_ET_AL__2017): omega 239 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2459554.243825 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 13 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-106315's measured colour (#efeeff, the colour lens of hd-106315 (src/objects/hd-106315/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 106315's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (46, 91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-106315b.json).


## Known problems

- **Orbit convention.** omega 239 degrees is taken as Barros et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.093) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
