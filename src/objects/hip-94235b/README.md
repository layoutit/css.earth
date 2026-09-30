# HIP 94235 b

## Sources

It is the only planet known around HIP 94235. Its orbit and size follow Zhou et al. 2022's fit, the archive's default. The introduction is generated from Zhou et al. 2022's published values; the sections below are the data's own.

**Size and mass.** Radius 0.26764253 Jupiter radii from Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..289Z/abstract): 19,134.3 km at 71,492 km per Jupiter radius. No mass is measured: Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2022AJ....163..289Z/abstract) gives only an upper limit of 1.19246736 Jupiter masses, so GM is 0, the records' unpublished value. A sphere: no oblateness is measured.

**Orbit.** Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive ps table (pl_refname ZHOU_ET_AL_2022): P 7.713057 d Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive ps table (pl_refname ZHOU_ET_AL_2022): a/R* 15.7; Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive ps table (pl_refname ZHOU_ET_AL_2022): inclination 87.14 degrees Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive ps table (pl_refname ZHOU_ET_AL_2022): e 0.32 Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive ps table (pl_refname ZHOU_ET_AL_2022): omega 17 degrees Zhou et al. 2022 (2022AJ....163..289Z), via the NASA Exoplanet Archive ps table (pl_refname ZHOU_ET_AL_2022): transit mid-time 2459037.8704 BJD, taken as BJD_TDB; with its period, the row that predicts 2026-01-01 best (1 sigma 8 min) Display convention: transit photometry does not measure the orbit's position angle on the sky, so the ascending node is set at position angle 0 (celestial north).

**Colour.** No image or measured colour exists. The neutral gray is lit by hip-94235's measured colour (#fff6fc, the colour dataset of hip-94235 (src/objects/hip-94235/source/photometry/stellar-color.json)) at the gray's own brightness.

**Charts.** The orbits of HIP 94235's planets from above, from their hosted-orbit records, and its transit in 3 TESS sectors (101, 103, 104), folded onto its orbit. Upper limits and rows without an error are left out.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts); the orbit is the one recorded in [its astronomy record](../../../packages/astronomy/data/bodies/hip-94235b.json).

## Known problems

- **Orbit convention.** omega 17 degrees is taken as Zhou et al. 2022 gives it through the archive (pl_orblper); papers differ on whether that is the star's or the planet's argument of periastron. The epoch is the transit, so a swapped convention would only mirror the ellipse (e 0.32) about the line of sight.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
