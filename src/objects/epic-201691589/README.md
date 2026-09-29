# EPIC 201691589

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.16 solar masses and 10.9 solar radii; APOGEE spectra give 4,758 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3800799628916428544, distance 4,036 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201691589 (K2 campaign 1): PARAM asteroseismic distance (pc) 4035.46875 (16th-84th percentiles 3941.796875-4131.835938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.252 ± 0.019 mas (13.1 standard errors), is not used. Radius 10.851 +/- 0.3528 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201691589 (K2 campaign 1): PARAM radius (solar radii) 10.850994 (16th-84th percentiles 10.50171-11.207234), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1593 +/- 0.094 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201691589 (K2 campaign 1): PARAM mass (solar masses) 1.159296 (16th-84th percentiles 1.068145-1.256156), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,758 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201691589: APOGEE DR17 effective temperature 4757.9736 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,758 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,758 K and log g 2.43 (u1 0.695, u2 0.099): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
