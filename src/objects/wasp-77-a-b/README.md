# WASP-77 A b

## Sources

It is the only planet known around WASP-77 A. Its orbit and size follow Cortés-Zuleta et al. 2020's fit, the archive's default. This account was drafted from Noguer et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 1.23 Jupiter radii from Cortés-Zuleta et al. 2020 (2020A&A...636A..98C), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2020A&A...636A..98C/abstract): 87,935.2 km at 71,492 km per Jupiter radius. GM from the mass 1.6654 Jupiter masses (Noguer et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024PASP..136f4401N), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024PASP..136f4401N/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): P 1.360029395 d Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): a/R* 5.490086; Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): inclination 89.99 degrees Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): e 0.01353 Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): omega -88.29 degrees, stored as 271.71 Noguer et al. 2024 (2024PASP..136f4401N), via the NASA Exoplanet Archive ps table (pl_refname NOGUER_ET_AL__2024): transit mid-time 2459957.33786 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 1 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by wasp-77-a's measured colour (#ffefe8, the colour lens of wasp-77-a (src/objects/wasp-77-a/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of WASP-77 A's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (4, 31), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/wasp-77-a-b.json).


## Known problems

- **Orbit convention.** omega -88.29 degrees is taken as Noguer et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.01353) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
