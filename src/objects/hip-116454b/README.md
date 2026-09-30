# HIP 116454 b

## Sources

It is the only planet known around HIP 116454. Its orbit and size follow Thygesen et al. 2024's fit, the archive's default. This account was drafted from Thygesen et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.22026981 Jupiter radii from Thygesen et al. 2024 (2024AJ....168..161T), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168..161T/abstract): 15,747.5 km at 71,492 km per Jupiter radius. GM from the mass 0.03051961 Jupiter masses (Thygesen et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024AJ....168..161T), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024AJ....168..161T/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Thygesen et al. 2024 (2024AJ....168..161T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2024): P 9.1004157 d Thygesen et al. 2024 (2024AJ....168..161T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2024): a/R* 22.46; Thygesen et al. 2024 (2024AJ....168..161T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2024): inclination 88.91 degrees Thygesen et al. 2024 (2024AJ....168..161T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2024): e 0.215 Thygesen et al. 2024 (2024AJ....168..161T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2024): omega 88 degrees Thygesen et al. 2024 (2024AJ....168..161T), via the NASA Exoplanet Archive ps table (pl_refname THYGESEN_ET_AL__2024): transit mid-time 2458072.29291 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hip-116454's measured colour (#ffe7d1, the colour dataset of hip-116454 (src/objects/hip-116454/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HIP 116454's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (42, 70, 92), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hip-116454b.json).


## Known problems

- **Orbit convention.** omega 88 degrees is taken as Thygesen et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.215) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "HIP 116454 b" (revision 1348641166), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
