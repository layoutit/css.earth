# TOI-1855 b

## Sources

It is the only planet known around TOI-1855. Its orbit and size follow Schulte et al. 2024's fit, the archive's default. This account was drafted from Schulte et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 1.65 Jupiter radii from Schulte et al. 2024 (2024AJ....168...32S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....168...32S/abstract): 117,961.8 km at 71,492 km per Jupiter radius. GM from the mass 1.133 Jupiter masses (Schulte et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024AJ....168...32S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024AJ....168...32S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Schulte et al. 2024 (2024AJ....168...32S), via the NASA Exoplanet Archive ps table (pl_refname SCHULTE_ET_AL__2024): P 1.36414864 d Schulte et al. 2024 (2024AJ....168...32S), via the NASA Exoplanet Archive ps table (pl_refname SCHULTE_ET_AL__2024): a/R* 4.95; Schulte et al. 2024 (2024AJ....168...32S), via the NASA Exoplanet Archive ps table (pl_refname SCHULTE_ET_AL__2024): inclination 78.1 degrees Schulte et al. 2024 (2024AJ....168...32S), via the NASA Exoplanet Archive ps table (pl_refname SCHULTE_ET_AL__2024): e 0.033 Schulte et al. 2024 (2024AJ....168...32S), via the NASA Exoplanet Archive ps table (pl_refname SCHULTE_ET_AL__2024): omega -100 degrees, stored as 260 Schulte et al. 2024 (2024AJ....168...32S), via the NASA Exoplanet Archive ps table (pl_refname SCHULTE_ET_AL__2024): transit mid-time 2459243.19743 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-1855's measured colour (#ffe9d9, the colour lens of toi-1855 (src/objects/toi-1855/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-1855's planets from above, from their hosted-orbit records, and its transit in 1 TESS sector (50), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-1855b.json).


## Known problems

- **Orbit convention.** omega -100 degrees is taken as Schulte et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.033) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
