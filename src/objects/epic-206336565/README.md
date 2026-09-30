# EPIC 206336565

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.86 solar masses and 12.1 solar radii; APOGEE spectra give 4,573 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2622364030001849728, distance 3,283 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206336565 (K2 campaign 3): PARAM asteroseismic distance (pc) 3282.96875 (16th-84th percentiles 3212.265625-3373.007812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.272 ± 0.016 mas (16.7 standard errors), is not used. Radius 12.1398 +/- 0.4284 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206336565 (K2 campaign 3): PARAM radius (solar radii) 12.139815 (16th-84th percentiles 11.798841-12.655656), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8629 +/- 0.0698 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206336565 (K2 campaign 3): PARAM mass (solar masses) 0.862865 (16th-84th percentiles 0.810046-0.949584), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,573 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206336565: APOGEE DR17 effective temperature 4573.0137 +/- 50 K (the catalogue's final uncertainty). log g 2.21 from the mass and radius.

**Colour.** A Planck spectrum at 4,573 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,573 K and log g 2.21 (u1 0.751, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
