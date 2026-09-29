# NGTS-11 b

## Sources

It is the only planet known around NGTS-11. Its orbit and size follow Gill et al. 2020's fit, the archive's default. This account was drafted from Gill et al. 2020's values; the sections below are the data's own.

**Size and mass.** Radius 0.817 Jupiter radii from Gill et al. 2020 (2020ApJ...898L..11G), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract): 58,409 km at 71,492 km per Jupiter radius. GM from the mass 0.344 Jupiter masses (Gill et al. 2020, the mass the NASA Exoplanet Archive's composite table adopts (2020ApJ...898L..11G), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2020ApJ...898L..11G/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): P 35.455984 d Gill et al. 2020 (2020ApJ...898L..11G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL__2020): a/R* 54.6; Gill et al. 2020 (2020ApJ...898L..11G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL__2020): inclination 89.16 degrees Gill et al. 2020 (2020ApJ...898L..11G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL__2020): e 0.13 Gill et al. 2020 (2020ApJ...898L..11G), via the NASA Exoplanet Archive ps table (pl_refname GILL_ET_AL__2020): omega 32 degrees Ivshina & Winn 2022 (2022ApJS..259...62I), via the NASA Exoplanet Archive ps table (pl_refname IVSHINA__AMP__WINN_2022): transit mid-time 2458390.70545 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 8 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by ngts-11's measured colour (#ffe1cc, the colour lens of ngts-11 (src/objects/ngts-11/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of NGTS-11's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (30, 97), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/ngts-11b.json).


## Known problems

- **Orbit convention.** omega 32 degrees is taken as Gill et al. 2020 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.13) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
