# TOI-3568 b

## Sources

It is the only planet known around TOI-3568. Its orbit and size follow Martioli et al. 2024's fit, the archive's default. This account was drafted from Martioli et al. 2024's values; the sections below are the data's own.

**Size and mass.** Radius 0.483 Jupiter radii from Martioli et al. 2024 (2024A&A...690A.312M), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024A&A...690A.312M/abstract): 34,530.6 km at 71,492 km per Jupiter radius. GM from the mass 0.083 Jupiter masses (Martioli et al. 2024, the mass the NASA Exoplanet Archive's composite table adopts (2024A&A...690A.312M), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2024A&A...690A.312M/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** Martioli et al. 2024 (2024A&A...690A.312M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2024): P 4.417965 d Martioli et al. 2024 (2024A&A...690A.312M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2024): a/R* 13.1; Martioli et al. 2024 (2024A&A...690A.312M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2024): inclination 89.2 degrees Martioli et al. 2024 (2024A&A...690A.312M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2024): e 0.035 Martioli et al. 2024 (2024A&A...690A.312M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2024): omega -0.9 degrees, stored as 359.1 Martioli et al. 2024 (2024A&A...690A.312M), via the NASA Exoplanet Archive ps table (pl_refname MARTIOLI_ET_AL_2024): transit mid-time 2459799.3834 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-3568's measured colour (#ffd9bf, the colour dataset of toi-3568 (src/objects/toi-3568/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-3568's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (56, 82, 83), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-3568b.json).


## Known problems

- **Orbit convention.** omega -0.9 degrees is taken as Martioli et al. 2024 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.035) about the line of sight.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
