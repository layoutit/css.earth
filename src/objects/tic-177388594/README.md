# TIC 177388594

## Sources

Its oscillations, recorded by TESS, give 1.30 solar masses and 10.8 solar radii; APOGEE spectra give 4,845 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5260991791190158208, distance 1,016 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 177388594 (observed by TESS): PARAM asteroseismic distance (pc) 1016.113281 (16th-84th percentiles 1006.826172-1026.992188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.992 ± 0.009 mas (105.7 standard errors), is not used. Radius 10.8016 +/- 0.1715 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 177388594 (observed by TESS): PARAM radius (solar radii) 10.801631 (16th-84th percentiles 10.676887-11.019943), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3001 +/- 0.0563 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 177388594 (observed by TESS): PARAM mass (solar masses) 1.300149 (16th-84th percentiles 1.255973-1.368542), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,845 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 177388594: APOGEE DR17 effective temperature 4844.5317 +/- 50 K (the catalogue's final uncertainty). log g 2.49 from the mass and radius.

**Colour.** A Planck spectrum at 4,845 K, because pARAM fits an extinction A_V = 0.48 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,845 K and log g 2.49 (u1 0.670, u2 0.117): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
