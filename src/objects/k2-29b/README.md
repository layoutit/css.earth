# K2-29 b

## Sources

It is the only planet known around K2-29. Its orbit and size follow Santerne et al. 2016's fit, the archive's default. This account was drafted from Santerne et al. 2016's values; the sections below are the data's own.

**Size and mass.** Radius 1.19 Jupiter radii from Santerne et al. 2016 (2016ApJ...824...55S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016ApJ...824...55S/abstract): 85,075.5 km at 71,492 km per Jupiter radius. GM from the mass 0.73 Jupiter masses (Santerne et al. 2016, the mass the NASA Exoplanet Archive's composite table adopts (2016ApJ...824...55S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2016ApJ...824...55S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): P 3.25883406 d Santerne et al. 2016 (2016ApJ...824...55S), via the NASA Exoplanet Archive ps table (pl_refname SANTERNE_ET_AL__2016): a/R* 10.51; Santerne et al. 2016 (2016ApJ...824...55S), via the NASA Exoplanet Archive ps table (pl_refname SANTERNE_ET_AL__2016): inclination 86.656 degrees Santerne et al. 2016 (2016ApJ...824...55S), via the NASA Exoplanet Archive ps table (pl_refname SANTERNE_ET_AL__2016): e 0.066 Santerne et al. 2016 (2016ApJ...824...55S), via the NASA Exoplanet Archive ps table (pl_refname SANTERNE_ET_AL__2016): omega 132 degrees Kokori et al. 2023 (2023ApJS..265....4K), via the NASA Exoplanet Archive ps table (pl_refname KOKORI_ET_AL__2023): transit mid-time 2458560.23617 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-29's measured colour (#ffdcbc, the colour lens of k2-29 (src/objects/k2-29/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-29's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (44, 70, 71), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-29b.json).


## Known problems

- **Orbit convention.** omega 132 degrees is taken as Santerne et al. 2016 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.066) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
