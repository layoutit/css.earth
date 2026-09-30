# TOI-1062 b

## Sources

It is one of 2 planets known around TOI-1062. Its orbit and size follow Otegi et al. 2021's fit, the archive's default. This account was drafted from Otegi et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.20207011 Jupiter radii from Otegi et al. 2021 (2021A&A...653A.105O), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...653A.105O/abstract): 14,446.4 km at 71,492 km per Jupiter radius. GM from the mass 0.03193547 Jupiter masses (Otegi et al. 2021, the mass the NASA Exoplanet Archive's composite table adopts (2021A&A...653A.105O), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2021A&A...653A.105O/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 4.11505271542 d Otegi et al. 2021 (2021A&A...653A.105O), via the NASA Exoplanet Archive ps table (pl_refname OTEGI_ET_AL__2021): a/R* derived from its semi-major axis 0.052 au and stellar radius 0.84 solar radii; Otegi et al. 2021 (2021A&A...653A.105O), via the NASA Exoplanet Archive ps table (pl_refname OTEGI_ET_AL__2021): inclination 85.913 degrees Otegi et al. 2021 (2021A&A...653A.105O), via the NASA Exoplanet Archive ps table (pl_refname OTEGI_ET_AL__2021): e 0.177 Otegi et al. 2021 (2021A&A...653A.105O), via the NASA Exoplanet Archive ps table (pl_refname OTEGI_ET_AL__2021): omega 117 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460901.447952 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1062's measured colour (#ffe7d8, the colour dataset of toi-1062 (src/objects/toi-1062/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1062's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (93, 94, 95), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1062b.json).


## Known problems

- **Orbit convention.** omega 117 degrees is taken as Otegi et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.177) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
