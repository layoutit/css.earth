# TOI-178 d

## Sources

It is one of 6 planets known around TOI-178. Its orbit and size follow Leleu et al. 2024's fit, the archive's default. This account was drafted from Leleu et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.24043221 Jupiter radii from Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...688A.211L/abstract): 17,189 km at 71,492 km per Jupiter radius. GM from the mass 0.01636103 Jupiter masses (Leleu et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...688A.211L), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...688A.211L/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 6.5578513 d Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2024): a/R* derived by Kepler's third law from its period 6.5578513 d, stellar mass 0.647 and radius 0.662 solar units; Leleu et al. 2021 (2021A&A...649A..26L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2021): inclination 88.58 degrees Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2024): e 0.0068 Leleu et al. 2024 (2024A&A...688A.211L), via the NASA Exoplanet Archive ps table (pl_refname LELEU_ET_AL__2024): omega -146.3 degrees, stored as 213.7 ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2460196.437088 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 3 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-178's measured colour (#ffc8a5, the colour lens of toi-178 (src/objects/toi-178/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-178's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (29, 69, 106), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-178d.json).


## Known problems

- **Orbit convention.** omega -146.3 degrees is taken as Leleu et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.0068) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
