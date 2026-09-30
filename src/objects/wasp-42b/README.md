# WASP-42 b

## Sources

It is the only planet known around WASP-42. Its orbit and size follow Southworth et al. 2016's fit, the archive's default. This account was drafted from Southworth et al. 2016's values; the sections below are the data's own.

**Size and mass.** Radius 1.122 Jupiter radii from Southworth et al. 2016 (2016MNRAS.457.4205S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2016MNRAS.457.4205S/abstract): 80,214 km at 71,492 km per Jupiter radius. GM from the mass 0.527 Jupiter masses (Southworth et al. 2016, the mass the NASA Exoplanet Archive's composite table adopts (2016MNRAS.457.4205S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2016MNRAS.457.4205S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): P 4.98168178 d Southworth et al. 2016 (2016MNRAS.457.4205S), via the NASA Exoplanet Archive ps table (pl_refname SOUTHWORTH_ET_AL__2016): a/R* 13.5; Southworth et al. 2016 (2016MNRAS.457.4205S), via the NASA Exoplanet Archive ps table (pl_refname SOUTHWORTH_ET_AL__2016): inclination 88 degrees Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): e 0.062 Bonomo et al. 2017 (2017A&A...602A.107B), via the NASA Exoplanet Archive ps table (pl_refname BONOMO_ET_AL__2017): omega 159 degrees Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): transit mid-time 2456472.54482 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-42's measured colour (#ffdec5, the colour dataset of wasp-42 (src/objects/wasp-42/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-42's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (37, 64, 101), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-42b.json).


## Known problems

- **Orbit convention.** omega 159 degrees is taken as Bonomo et al. 2017 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.062) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
