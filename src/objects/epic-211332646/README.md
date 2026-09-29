# EPIC 211332646

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.95 solar masses and 8.5 solar radii; APOGEE spectra give 4,756 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 600034251539494656, distance 2,402 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211332646 (K2 campaign 5): PARAM asteroseismic distance (pc) 2402.421875 (16th-84th percentiles 2317.792969-2492.871094), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.394 ± 0.020 mas (19.8 standard errors), is not used. Radius 8.4869 +/- 0.3568 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211332646 (K2 campaign 5): PARAM radius (solar radii) 8.486893 (16th-84th percentiles 8.152453-8.866056), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9489 +/- 0.0985 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211332646 (K2 campaign 5): PARAM mass (solar masses) 0.948888 (16th-84th percentiles 0.858829-1.055759), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,756 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211332646: APOGEE DR17 effective temperature 4755.531 +/- 50 K (the catalogue's final uncertainty). log g 2.56 from the mass and radius.

**Colour.** A Planck spectrum at 4,756 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,756 K and log g 2.56 (u1 0.698, u2 0.097): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
