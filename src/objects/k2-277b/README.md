# K2-277 b

## Sources

It is the only planet known around K2-277. Its orbit and size follow Thygesen et al. 2023's fit, the archive's default. This account was drafted from Thygesen et al. 2023's values; the sections below are the data's own.

**Size and mass.** Radius 0.195 Jupiter radii from Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2023AJ....165..155T/abstract): 13,940.9 km at 71,492 km per Jupiter radius. GM from the mass 0.023283 Jupiter masses (Howard et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025ApJS..278...52H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025ApJS..278...52H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): P 6.326768 d Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): a/R* 14.68; Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): inclination 86.83 degrees Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): e 0.52 Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): omega 46 degrees Thygesen et al. 2023 (2023AJ....165..155T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2023): transit mid-time 2457303.4771 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 13 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by k2-277's measured colour (#fff0eb, the colour lens of k2-277 (src/objects/k2-277/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of K2-277's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (10, 37, 91), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/k2-277b.json).


## Known problems

- **Orbit convention.** omega 46 degrees is taken as Thygesen et al. 2023 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.52) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
