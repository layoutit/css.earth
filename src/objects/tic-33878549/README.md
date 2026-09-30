# TIC 33878549

## Sources

Its oscillations, recorded by TESS, give 0.87 solar masses and 18.7 solar radii; APOGEE spectra give 4,421 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4652603660758350848, distance 1,300 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 33878549 (observed by TESS): PARAM asteroseismic distance (pc) 1300.234375 (16th-84th percentiles 1278.085938-1326.074219), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.727 ± 0.021 mas (34.6 standard errors), is not used. Radius 18.7461 +/- 0.5717 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 33878549 (observed by TESS): PARAM radius (solar radii) 18.746075 (16th-84th percentiles 18.273355-19.416686), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8737 +/- 0.0739 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 33878549 (observed by TESS): PARAM mass (solar masses) 0.873657 (16th-84th percentiles 0.813743-0.961602), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,421 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 33878549: APOGEE DR17 effective temperature 4421.066 +/- 50 K (the catalogue's final uncertainty). log g 1.83 from the mass and radius.

**Colour.** A Planck spectrum at 4,421 K, because pARAM fits an extinction A_V = 0.26 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,421 K and log g 1.83 (u1 0.796, u2 0.022): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
