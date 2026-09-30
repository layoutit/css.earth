# TOI-2458 b

## Sources

It is one of 2 planets known around TOI-2458. Its orbit and size follow &Scaron;ubjak et al. 2025's fit, the archive's default. The introduction is generated from &Scaron;ubjak et al. 2025's published values; the sections below are the data's own.

**Size and mass.** Radius 0.25247612 Jupiter radii from &Scaron;ubjak et al. 2025 (2025A&A...693A.235S), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2025A&A...693A.235S/abstract): 18,050 km at 71,492 km per Jupiter radius. GM from the mass 0.04187794 Jupiter masses (&Scaron;ubjak et al. 2025, the mass the NASA Exoplanet Archive's composite table adopts (2025A&A...693A.235S), via the NASA Exoplanet Archive, https://ui.adsabs.harvard.edu/abs/2025A&A...693A.235S/abstract) times JPL's Jupiter GM. A sphere: no oblateness is measured.

**Orbit.** &Scaron;ubjak et al. 2025 (2025A&A...693A.235S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2025): P 3.73659 d &Scaron;ubjak et al. 2025 (2025A&A...693A.235S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2025): a/R* derived from its semi-major axis 0.0482 au and stellar radius 1.31 solar radii; &Scaron;ubjak et al. 2025 (2025A&A...693A.235S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2025): inclination 84.03 degrees &Scaron;ubjak et al. 2025 (2025A&A...693A.235S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2025): e 0.087 &Scaron;ubjak et al. 2025 (2025A&A...693A.235S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2025): omega -26 degrees, stored as 334 &Scaron;ubjak et al. 2025 (2025A&A...693A.235S), via the NASA Exoplanet Archive ps table (pl_refname SUBJAK_ET_AL_2025): transit mid-time 2459177.4046 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 316 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2458's measured colour (#fef8ff, the colour dataset of toi-2458 (src/objects/toi-2458/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2458's planets from above, from their hosted-orbit records, and its transit in 2 TESS sectors (32, 98), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2458b.json).

## Known problems

- **Orbit convention.** omega -26 degrees is taken as &Scaron;ubjak et al. 2025 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.087) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
