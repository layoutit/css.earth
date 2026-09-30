# EPIC 214719219

## Sources

Its oscillations, recorded in K2 campaign 7, give 0.75 solar masses and 16.3 solar radii; APOGEE spectra give 4,803 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4073171306512879744, distance 6,301 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214719219 (K2 campaign 7): PARAM asteroseismic distance (pc) 6301.09375 (16th-84th percentiles 6158.203125-6484.921875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.147 ± 0.021 mas (6.9 standard errors), is not used. Radius 16.2782 +/- 0.6661 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214719219 (K2 campaign 7): PARAM radius (solar radii) 16.278151 (16th-84th percentiles 15.776115-17.108408), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7499 +/- 0.0667 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214719219 (K2 campaign 7): PARAM mass (solar masses) 0.749925 (16th-84th percentiles 0.704552-0.837858), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,803 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214719219: APOGEE DR17 effective temperature 4803.3420000000015 +/- 50 K (the catalogue's final uncertainty). log g 1.89 from the mass and radius.

**Colour.** A Planck spectrum at 4,803 K, because pARAM fits an extinction A_V = 0.77 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,803 K and log g 1.89 (u1 0.677, u2 0.112): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
