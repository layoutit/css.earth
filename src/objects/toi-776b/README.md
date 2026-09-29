# TOI-776 b

## Sources

It is one of 2 planets known around TOI-776. Its orbit and size follow Fridlund et al. 2024's fit, the archive's default. This account was drafted from Fridlund et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.16040709 Jupiter radii from Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...684A..12F/abstract): 11,467.8 km at 71,492 km per Jupiter radius. GM from the mass 0.01573176 Jupiter masses (Fridlund et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...684A..12F), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...684A..12F/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): P 8.2466132695 d Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): a/R* derived from its semi-major axis 0.0653 au and stellar radius 0.547 solar radii; Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): inclination 89.41 degrees Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): e 0.052 Fridlund et al. 2024 (2024A&A...684A..12F), via the NASA Exoplanet Archive ps table (pl_refname FRIDLUND_ET_AL__2024): omega 45 degrees ExoFOP, via the NASA Exoplanet Archive ps table (pl_refname EXOFOP): transit mid-time 2458571.415963 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 7 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-776's measured colour (#ffbf89, the colour lens of toi-776 (src/objects/toi-776/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-776's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (90, 100, 101), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object.mts](../../../tools/objects/new-object.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-776b.json).


## Known problems

- **Orbit convention.** omega 45 degrees is taken as Fridlund et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.052) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
