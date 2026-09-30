# TOI-2257 b

## Sources

It is the only planet known around TOI-2257. Its orbit and size follow Schanche et al. 2022's fit, the archive's default. This account was drafted from Schanche et al. 2022's values; the sections below are the data's own.

**Size and mass.** Radius 0.19573591 Jupiter radii from Schanche et al. 2022 (2022A&A...657A..45S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022A&A...657A..45S/abstract): 13,993.6 km at 71,492 km per Jupiter radius. GM from the mass 0.0171 Jupiter masses (the NASA Exoplanet Archive's calculated value (M-R relationship, its Chen & Kipping 2017 mass-radius relationship): a model, not a measurement, via the NASA Exoplanet Archive, https://exoplanetarchive.ipac.caltech.edu/docs/pscp_calc.html) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Schanche et al. 2022 (2022A&A...657A..45S), via the NASA Exoplanet Archive ps table (pl_refname SCHANCHE_ET_AL__2022): P 35.189346 d Schanche et al. 2022 (2022A&A...657A..45S), via the NASA Exoplanet Archive ps table (pl_refname SCHANCHE_ET_AL__2022): a/R* derived from its semi-major axis 0.145 au and stellar radius 0.313 solar radii; Schanche et al. 2022 (2022A&A...657A..45S), via the NASA Exoplanet Archive ps table (pl_refname SCHANCHE_ET_AL__2022): inclination 89.786 degrees Schanche et al. 2022 (2022A&A...657A..45S), via the NASA Exoplanet Archive ps table (pl_refname SCHANCHE_ET_AL__2022): e 0.496 Schanche et al. 2022 (2022A&A...657A..45S), via the NASA Exoplanet Archive ps table (pl_refname SCHANCHE_ET_AL__2022): omega -101.674 degrees, stored as 258.326 Schanche et al. 2022 (2022A&A...657A..45S), via the NASA Exoplanet Archive ps table (pl_refname SCHANCHE_ET_AL__2022): transit mid-time 2459007.97949 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 8 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2257's measured colour (#ffc683, the colour dataset of toi-2257 (src/objects/toi-2257/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2257's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (53, 74, 75), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2257b.json).


## Known problems

- **Orbit convention.** omega -101.674 degrees is taken as Schanche et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.496) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-2257 b" (revision 1374086937), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
