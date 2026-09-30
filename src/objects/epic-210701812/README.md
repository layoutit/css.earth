# EPIC 210701812

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.04 solar masses and 9.1 solar radii; APOGEE spectra give 4,801 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 56688659162070912, distance 2,968 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210701812 (K2 campaign 4): PARAM asteroseismic distance (pc) 2968.359375 (16th-84th percentiles 2863.164062-3071.796875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.334 ± 0.017 mas (19.9 standard errors), is not used. Radius 9.1317 +/- 0.4111 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210701812 (K2 campaign 4): PARAM radius (solar radii) 9.131737 (16th-84th percentiles 8.72395-9.546228), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0369 +/- 0.113 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210701812 (K2 campaign 4): PARAM mass (solar masses) 1.036858 (16th-84th percentiles 0.926483-1.152458), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,801 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210701812: APOGEE DR17 effective temperature 4800.5645 +/- 50 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Colour.** A Planck spectrum at 4,801 K, because pARAM fits an extinction A_V = 0.35 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,801 K and log g 2.53 (u1 0.684, u2 0.107): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
