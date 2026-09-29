# WASP-59 b

## Sources

It is the only planet known around WASP-59. Its orbit and size follow Hebrard et al. 2013's fit, the archive's default. This account was drafted from Hebrard et al. 2013's values; the sections below are the data's own.

**Size and mass.** Radius 0.775 Jupiter radii from Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A%26A...549A.134H/abstract): 55,406.3 km at 71,492 km per Jupiter radius. GM from the mass 0.863 Jupiter masses (Hebrard et al. 2013, the mass the NASA Exoplanet Archive's composite table adopts (2013A&A...549A.134H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2013A%26A...549A.134H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): P 7.919585 d Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): a/R* 24.39; Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): inclination 89.27 degrees Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): e 0.1 Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): omega 74 degrees Hebrard et al. 2013 (2013A&A...549A.134H), via the NASA Exoplanet Archive ps table (pl_refname HEBRARD_ET_AL__2013): transit mid-time 2455830.95559 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 10 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-59's measured colour (#ffc49f, the colour lens of wasp-59 (src/objects/wasp-59/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-59's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (56, 83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-59b.json).


## Known problems

- **Orbit convention.** omega 74 degrees is taken as Hebrard et al. 2013 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.1) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
