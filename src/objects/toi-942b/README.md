# TOI-942 b

## Sources

It is one of 2 planets known around TOI-942. Its orbit and size follow Wirth et al. 2021's fit, the archive's default. This account was drafted from Wirth et al. 2021's values; the sections below are the data's own.

**Size and mass.** Radius 0.34704315 Jupiter radii from Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021ApJ...917L..34W/abstract): 24,810.8 km at 71,492 km per Jupiter radius. No mass is measured: Zhou et al. 2021 (2021AJ....161....2Z), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2021AJ....161....2Z/abstract) gives only an upper limit of 2.6 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): P 4.32421 d Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): a/R* derived from its semi-major axis 0.04866 au and stellar radius 0.894 solar radii; Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): inclination 89.966 degrees Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): e 0.34 Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): omega -16 degrees, stored as 344 Wirth et al. 2021 (2021ApJ...917L..34W), via the NASA Exoplanet Archive ps table (pl_refname WIRTH_ET_AL__2021): transit mid-time 2458441.579 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 17 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-942's measured colour (#ffe0cb, the colour lens of toi-942 (src/objects/toi-942/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-942's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (32, 98, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-942b.json).


## Known problems

- **Orbit convention.** omega -16 degrees is taken as Wirth et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.34) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
