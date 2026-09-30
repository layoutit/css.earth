# EPIC 212308990

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.00 solar masses and 8.3 solar radii; APOGEE spectra give 5,230 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3508283012842259200, distance 3,476 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212308990 (K2 campaign 6): PARAM asteroseismic distance (pc) 3476.289062 (16th-84th percentiles 3348.75-3608.789062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.259 ± 0.019 mas (13.4 standard errors), is not used. Radius 8.2826 +/- 0.427 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212308990 (K2 campaign 6): PARAM radius (solar radii) 8.282604 (16th-84th percentiles 7.891401-8.745408), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0015 +/- 0.1256 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212308990 (K2 campaign 6): PARAM mass (solar masses) 1.001467 (16th-84th percentiles 0.89044-1.141555), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,230 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212308990: APOGEE DR17 effective temperature 5229.643 +/- 353 K (the catalogue's final uncertainty). log g 2.6 from the mass and radius.

**Colour.** A Planck spectrum at 5,230 K, because pARAM fits an extinction A_V = 0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffead8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,230 K and log g 2.6 (u1 0.564, u2 0.192): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
