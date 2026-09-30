# EPIC 210326403

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.65 solar masses and 10.6 solar radii; APOGEE spectra give 5,059 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 36656072700378880, distance 2,636 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210326403 (K2 campaign 4): PARAM asteroseismic distance (pc) 2635.742188 (16th-84th percentiles 2607.070312-2664.335938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.358 ± 0.014 mas (24.7 standard errors), is not used. Radius 10.5583 +/- 0.1021 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210326403 (K2 campaign 4): PARAM radius (solar radii) 10.558312 (16th-84th percentiles 10.446948-10.651049), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.6478 +/- 0.0373 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210326403 (K2 campaign 4): PARAM mass (solar masses) 1.647837 (16th-84th percentiles 1.607783-1.682297), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,059 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210326403: APOGEE DR17 effective temperature 5059.3174 +/- 50 K (the catalogue's final uncertainty). log g 2.61 from the mass and radius.

**Colour.** A Planck spectrum at 5,059 K, because pARAM fits an extinction A_V = 0.98 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,059 K and log g 2.61 (u1 0.610, u2 0.161): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
