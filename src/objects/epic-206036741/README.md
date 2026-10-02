# EPIC 206036741

## Sources

Its oscillations, recorded in K2 campaign 3, give 1.17 solar masses and 5.8 solar radii; APOGEE spectra give 4,934 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6839808265820989056, distance 1,556 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206036741 (K2 campaign 3): PARAM asteroseismic distance (pc) 1555.878906 (16th-84th percentiles 1515.859375-1597.460938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.649 ± 0.019 mas (33.8 standard errors), is not used. Radius 5.8193 +/- 0.188 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206036741 (K2 campaign 3): PARAM radius (solar radii) 5.819257 (16th-84th percentiles 5.635713-6.011763), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1736 +/- 0.0915 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206036741 (K2 campaign 3): PARAM mass (solar masses) 1.173561 (16th-84th percentiles 1.086637-1.269592), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,934 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206036741: APOGEE DR17 effective temperature 4934.0874 +/- 50 K (the catalogue's final uncertainty). log g 2.98 from the mass and radius.

**Color.** A Planck spectrum at 4,934 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,934 K and log g 2.98 (u1 0.651, u2 0.131): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
