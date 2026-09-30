# TOI-2406 b

## Sources

It is the only planet known around TOI-2406. Its orbit and size follow Hori et al. 2024's fit, the archive's default. The introduction is generated from Hori et al. 2024's published values; the sections below are the data's own.

**Size and mass.** Radius 0.25515255 Jupiter radii from Hori et al. 2024 (2024AJ....167..289H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract): 18,241.4 km at 71,492 km per Jupiter radius. No mass is measured: Hori et al. 2024 (2024AJ....167..289H), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024AJ....167..289H/abstract) gives only an upper limit of 0.04908309 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Hori et al. 2024 (2024AJ....167..289H), via the NASA Exoplanet Archive ps table (pl_refname HORI_ET_AL_2024): P 3.0766891 d Hori et al. 2024 (2024AJ....167..289H), via the NASA Exoplanet Archive ps table (pl_refname HORI_ET_AL_2024): a/R* 23.95; Hori et al. 2024 (2024AJ....167..289H), via the NASA Exoplanet Archive ps table (pl_refname HORI_ET_AL_2024): inclination 89.8 degrees Wells et al. 2021 (2021A&A...653A..97W), via the NASA Exoplanet Archive ps table (pl_refname WELLS_ET_AL__2021): e 0.26 Wells et al. 2021 (2021A&A...653A..97W), via the NASA Exoplanet Archive ps table (pl_refname WELLS_ET_AL__2021): omega 279 degrees Hori et al. 2024 (2024AJ....167..289H), via the NASA Exoplanet Archive ps table (pl_refname HORI_ET_AL_2024): transit mid-time 2459115.976 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 2 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by toi-2406's measured colour (#ffbb74, the colour dataset of toi-2406 (src/objects/toi-2406/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of TOI-2406's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (42, 43, 70), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/toi-2406b.json).

## Known problems

- **Orbit convention.** omega 279 degrees is taken as Wells et al. 2021 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.26) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
