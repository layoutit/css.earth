# EPIC 201521936

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.11 solar masses and 12.6 solar radii; APOGEE spectra give 4,830 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3891259237968744192, distance 5,246 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201521936 (K2 campaign 10): PARAM asteroseismic distance (pc) 5245.46875 (16th-84th percentiles 5112.109375-5396.171875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.268 ± 0.026 mas (10.2 standard errors), is not used. Radius 12.5774 +/- 0.6427 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201521936 (K2 campaign 10): PARAM radius (solar radii) 12.577421 (16th-84th percentiles 12.016133-13.301516), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1098 +/- 0.1346 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201521936 (K2 campaign 10): PARAM mass (solar masses) 1.109782 (16th-84th percentiles 0.991844-1.261141), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,830 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201521936: APOGEE DR17 effective temperature 4829.778 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Color.** A Planck spectrum at 4,830 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,830 K and log g 2.28 (u1 0.672, u2 0.116): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
