# EPIC 248540823

## Sources

Its oscillations, recorded in K2 campaign 14, give 1.60 solar masses and 14.1 solar radii; APOGEE spectra give 4,882 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3858511452365683712, distance 4,312 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248540823 (K2 campaign 14): PARAM asteroseismic distance (pc) 4311.992188 (16th-84th percentiles 4200.117188-4427.148438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.330 ± 0.018 mas (18.5 standard errors), is not used. Radius 14.1294 +/- 0.6834 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248540823 (K2 campaign 14): PARAM radius (solar radii) 14.129377 (16th-84th percentiles 13.535677-14.902378), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.5998 +/- 0.1779 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248540823 (K2 campaign 14): PARAM mass (solar masses) 1.599778 (16th-84th percentiles 1.452582-1.808387), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,882 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248540823: APOGEE DR17 effective temperature 4881.5 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 4,882 K, because pARAM fits an extinction A_V = 0.00 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,882 K and log g 2.34 (u1 0.658, u2 0.126): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
