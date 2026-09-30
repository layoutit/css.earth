# HD 108236 b

## Sources

It is one of 5 planets known around HD 108236. Its orbit and size follow Bonfanti et al. 2021's fit, the archive's default. The introduction is generated from Bonfanti et al. 2021's published values; the sections below are the data's own.

**Size and mass.** Radius 0.14408065 Jupiter radii from Bonfanti et al. 2021 (2021A&A...646A.157B), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021A&A...646A.157B/abstract): 10,300.6 km at 71,492 km per Jupiter radius. GM from the mass 0.0102 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 3.79588997084 d Bonfanti et al. 2021 (2021A&A...646A.157B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2021): a/R* derived from its semi-major axis 0.04527 au and stellar radius 0.877 solar radii; Bonfanti et al. 2021 (2021A&A...646A.157B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2021): inclination 87.59 degrees Bonfanti et al. 2021 (2021A&A...646A.157B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2021): e 0.045 Bonfanti et al. 2021 (2021A&A...646A.157B), via the NASA Exoplanet Archive ps table (pl_refname BONFANTI_ET_AL__2021): omega 126 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458572.107559 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 20 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hd-108236's measured colour (#fff4f4, the colour dataset of hd-108236 (src/objects/hd-108236/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HD 108236's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (99, 100, 101), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hd-108236b.json).

## Known problems

- **Orbit convention.** omega 126 degrees is taken as Bonfanti et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.045) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
