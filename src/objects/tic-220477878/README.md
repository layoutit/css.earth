# TIC 220477878

## Sources

Its oscillations, recorded by TESS, give 0.89 solar masses and 14.4 solar radii; APOGEE spectra give 4,559 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4762052449799688320, distance 1,360 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220477878 (observed by TESS): PARAM asteroseismic distance (pc) 1359.726562 (16th-84th percentiles 1331.855469-1388.730469), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.660 ± 0.010 mas (64.0 standard errors), is not used. Radius 14.3844 +/- 0.4461 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220477878 (observed by TESS): PARAM radius (solar radii) 14.384412 (16th-84th percentiles 13.967608-14.859766), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8936 +/- 0.0791 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220477878 (observed by TESS): PARAM mass (solar masses) 0.893594 (16th-84th percentiles 0.821922-0.98022), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,559 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220477878: APOGEE DR17 effective temperature 4559.273 +/- 50 K (the catalogue's final uncertainty). log g 2.07 from the mass and radius.

**Colour.** A Planck spectrum at 4,559 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,559 K and log g 2.07 (u1 0.753, u2 0.055): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
