# MASCARA-1 b

## Sources

It is the only planet known around MASCARA-1. Its orbit and size follow Hooton et al. 2022's fit, the archive's default. This account was drafted from Hooton et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 1.597 Jupiter radii from Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...658A..75H/abstract): 114,172.7 km at 71,492 km per Jupiter radius. GM from the mass 3.7 Jupiter masses (Talens et al. 2017, the mass the NASA Exoplanet Archive's composite table adopts (2017A&A...606A..73T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2017A&A...606A..73T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 2.1425095 d Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): a/R* 4.1676; Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): inclination 88.45 degrees Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): e 0.00034 Hooton et al. 2022 (2022A&A...658A..75H), via the NASA Exoplanet Archive ps table (pl_refname HOOTON_ET_AL__2022): omega -16 degrees, stored as 344 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460556.771408 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by mascara-1's measured colour (#cdd9ff, the colour lens of mascara-1 (src/objects/mascara-1/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of MASCARA-1's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (55, 82), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/mascara-1b.json).


## Known problems

- **Orbit convention.** omega -16 degrees is taken as Hooton et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.00034) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
