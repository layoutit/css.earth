# HAT-P-2 b

## Sources

It is one of 2 planets known around HAT-P-2. Its orbit and size follow Ment et al. 2018's fit, the archive's default. This account was drafted from Ment et al. 2018's values; the sections below are the data's own.

**Size and mass.** Radius 1.157 Jupiter radii from Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2017A&A...602A.107B/abstract): 82,716.2 km at 71,492 km per Jupiter radius. GM from the mass 9.02 Jupiter masses (de Beurs et al. 2023, the mass the NASA Exoplanet Archive's composite table adopts (2023AJ....166..136D), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2023AJ....166..136D/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 5.633477 d Ment et al. 2018 (2018AJ....156..213M), via the NASA Exoplanet Archive ps table (pl_refname MENT_ET_AL__2018): a/R* derived from its semi-major axis 0.06814 au and stellar radius 1.39 solar radii; Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): inclination 86.72 degrees Ment et al. 2018 (2018AJ....156..213M), via the NASA Exoplanet Archive ps table (pl_refname MENT_ET_AL__2018): e 0.5172 Ment et al. 2018 (2018AJ....156..213M), via the NASA Exoplanet Archive ps table (pl_refname MENT_ET_AL__2018): omega 188.01 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460477.275907 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hat-p-2's measured colour (#efeeff, the colour lens of hat-p-2 (src/objects/hat-p-2/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HAT-P-2's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (52, 78, 79), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hat-p-2b.json).


## Known problems

- **Orbit convention.** omega 188.01 degrees is taken as Ment et al. 2018 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.5172) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "HAT-P-2b" (revision 1374168637), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
