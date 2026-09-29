# TOI-677 b

## Sources

It is the only planet known around TOI-677. Its orbit and size follow Jordán et al. 2020's fit, the archive's default. This account was drafted from Hu et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 1.17 Jupiter radii from Hu et al. 2024 (2024AJ....167..175H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..175H/abstract): 83,645.6 km at 71,492 km per Jupiter radius. GM from the mass 1.234 Jupiter masses (Hu et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024AJ....167..175H), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024AJ....167..175H/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Hu et al. 2024 (2024AJ....167..175H), via the NASA Exoplanet Archive ps table (pl_refname HU_ET_AL__2024): P 11.2365985 d Hu et al. 2024 (2024AJ....167..175H), via the NASA Exoplanet Archive ps table (pl_refname HU_ET_AL__2024): a/R* 17.49; Hu et al. 2024 (2024AJ....167..175H), via the NASA Exoplanet Archive ps table (pl_refname HU_ET_AL__2024): inclination 85.77 degrees Hu et al. 2024 (2024AJ....167..175H), via the NASA Exoplanet Archive ps table (pl_refname HU_ET_AL__2024): e 0.46 Hu et al. 2024 (2024AJ....167..175H), via the NASA Exoplanet Archive ps table (pl_refname HU_ET_AL__2024): omega 72.9 degrees Hu et al. 2024 (2024AJ....167..175H), via the NASA Exoplanet Archive ps table (pl_refname HU_ET_AL__2024): transit mid-time 2458547.47449 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-677's measured colour (#fff7ff, the colour lens of toi-677 (src/objects/toi-677/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-677's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (63, 89, 90), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-677b.json).


## Known problems

- **Orbit convention.** omega 72.9 degrees is taken as Hu et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.46) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person; their quotes are sentences of the Wikipedia article "TOI-677 b" (revision 1374392731), verbatim, CC BY-SA 4.0.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
