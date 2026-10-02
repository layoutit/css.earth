# EPIC 249117427

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.03 solar masses and 11.2 solar radii; GALAH spectra give 4,902 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6234055492968369408, distance 3,452 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249117427 (K2 campaign 15): PARAM asteroseismic distance (pc) 3452.34375 (16th-84th percentiles 3354.84375-3579.6875), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.243 ± 0.016 mas (15.5 standard errors), is not used. Radius 11.2224 +/- 0.4955 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249117427 (K2 campaign 15): PARAM radius (solar radii) 11.222419 (16th-84th percentiles 10.768768-11.759863), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0277 +/- 0.1072 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249117427 (K2 campaign 15): PARAM mass (solar masses) 1.027718 (16th-84th percentiles 0.936097-1.150428), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,902 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249117427: GALAH DR3 effective temperature 4902.072 +/- 98 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Color.** A Planck spectrum at 4,902 K, because pARAM fits an extinction A_V = 0.54 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,902 K and log g 2.35 (u1 0.652, u2 0.131): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
