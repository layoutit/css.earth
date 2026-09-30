# EPIC 210664745

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.00 solar masses and 16.1 solar radii; APOGEE spectra give 4,260 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 56590218511757440, distance 2,231 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210664745 (K2 campaign 4): PARAM asteroseismic distance (pc) 2230.507812 (16th-84th percentiles 2138.769531-2331.484375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.449 ± 0.016 mas (28.0 standard errors), is not used. Radius 16.0535 +/- 0.8332 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210664745 (K2 campaign 4): PARAM radius (solar radii) 16.053518 (16th-84th percentiles 15.300655-16.967071), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0035 +/- 0.115 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210664745 (K2 campaign 4): PARAM mass (solar masses) 1.003496 (16th-84th percentiles 0.902411-1.132423), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,260 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210664745: APOGEE DR17 effective temperature 4259.5146 +/- 50 K (the catalogue's final uncertainty). log g 2.03 from the mass and radius.

**Colour.** A Planck spectrum at 4,260 K, because pARAM fits an extinction A_V = 0.49 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffd9b1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,260 K and log g 2.03 (u1 0.851, u2 -0.024): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
