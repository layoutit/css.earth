# EPIC 212335045

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.88 solar masses and 11.7 solar radii; APOGEE spectra give 4,456 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3605204417370728960, distance 5,514 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335045 (K2 campaign 6): PARAM asteroseismic distance (pc) 5513.59375 (16th-84th percentiles 5391.015625-5672.1875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.127 ± 0.024 mas (5.2 standard errors), is not used. Radius 11.6906 +/- 0.4005 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335045 (K2 campaign 6): PARAM radius (solar radii) 11.690641 (16th-84th percentiles 11.368428-12.169505), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.883 +/- 0.0691 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335045 (K2 campaign 6): PARAM mass (solar masses) 0.883032 (16th-84th percentiles 0.830509-0.968702), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,456 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335045: APOGEE DR17 effective temperature 4455.9 +/- 50 K (the catalogue's final uncertainty). log g 2.25 from the mass and radius.

**Color.** A Planck spectrum at 4,456 K, because pARAM fits an extinction A_V = 0.25 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,456 K and log g 2.25 (u1 0.789, u2 0.026): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
