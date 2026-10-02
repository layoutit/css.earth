# EPIC 247240677

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.92 solar masses and 17.7 solar radii; GALAH spectra give 4,727 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3401798751962940800, distance 1,685 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247240677 (K2 campaign 13): PARAM asteroseismic distance (pc) 1684.863281 (16th-84th percentiles 1622.949219-1738.417969), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.442 ± 0.020 mas (21.6 standard errors), is not used. Radius 17.6738 +/- 0.9891 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247240677 (K2 campaign 13): PARAM radius (solar radii) 17.673801 (16th-84th percentiles 16.510114-18.488299), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.9207 +/- 0.2354 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247240677 (K2 campaign 13): PARAM mass (solar masses) 1.920712 (16th-84th percentiles 1.651155-2.121921), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,727 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247240677: GALAH DR3 effective temperature 4726.6685 +/- 110 K (the catalogue's final uncertainty). log g 2.23 from the mass and radius.

**Color.** A Planck spectrum at 4,727 K, because pARAM fits an extinction A_V = 1.89 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the color routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,727 K and log g 2.23 (u1 0.703, u2 0.093): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
