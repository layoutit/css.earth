# EPIC 249141305

## Sources

Its oscillations, recorded in K2 campaign 15, give 0.96 solar masses and 8.7 solar radii; GALAH spectra give 4,650 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6234770686621536000, distance 2,608 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249141305 (K2 campaign 15): PARAM asteroseismic distance (pc) 2607.96875 (16th-84th percentiles 2514.6875-2713.789062), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.359 ± 0.018 mas (20.2 standard errors), is not used. Radius 8.6723 +/- 0.3819 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249141305 (K2 campaign 15): PARAM radius (solar radii) 8.672298 (16th-84th percentiles 8.321767-9.085488), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9633 +/- 0.1048 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249141305 (K2 campaign 15): PARAM mass (solar masses) 0.963284 (16th-84th percentiles 0.87061-1.080269), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,650 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249141305: GALAH DR3 effective temperature 4649.6587 +/- 133 K (the catalogue's final uncertainty). log g 2.55 from the mass and radius.

**Colour.** A Planck spectrum at 4,650 K, because pARAM fits an extinction A_V = 0.51 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,650 K and log g 2.55 (u1 0.732, u2 0.070): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
