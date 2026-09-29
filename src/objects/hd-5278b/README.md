# HD 5278 b

## Sources

It is one of 2 planets known around HD 5278. Its orbit and size follow Sozzetti et al. 2021's fit, the archive's default. This account was drafted from Sozzetti et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.21857474 Jupiter radii from Sozzetti et al. 2021 (2021A&A...648A..75S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...648A..75S/abstract): 15,626.3 km at 71,492 km per Jupiter radius. GM from the mass 0.02454154 Jupiter masses (Sozzetti et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021A&A...648A..75S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021A&A...648A..75S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 14.33913866687 d Sozzetti et al. 2021 (2021A&A...648A..75S), via the NASA Exoplanet Archive ps table (pl_refname SOZZETTI_ET_AL__2021): a/R* 22.4; Sozzetti et al. 2021 (2021A&A...648A..75S), via the NASA Exoplanet Archive ps table (pl_refname SOZZETTI_ET_AL__2021): inclination 89.27 degrees Sozzetti et al. 2021 (2021A&A...648A..75S), via the NASA Exoplanet Archive ps table (pl_refname SOZZETTI_ET_AL__2021): e 0.08 Sozzetti et al. 2021 (2021A&A...648A..75S), via the NASA Exoplanet Archive ps table (pl_refname SOZZETTI_ET_AL__2021): omega 135 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460888.931342 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 4 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-5278's measured colour (#f7f3ff, the colour lens of hd-5278 (src/objects/hd-5278/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 5278's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (93, 94, 95), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-5278b.json).


## Known problems

- **Orbit convention.** omega 135 degrees is taken as Sozzetti et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.08) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
