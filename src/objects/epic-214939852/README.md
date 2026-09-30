# EPIC 214939852

## Sources

Its oscillations, recorded in K2 campaign 7, give 0.87 solar masses and 10.0 solar radii; APOGEE spectra give 5,057 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4073421307979348864, distance 3,025 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214939852 (K2 campaign 7): PARAM asteroseismic distance (pc) 3024.53125 (16th-84th percentiles 2972.96875-3075.898438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.337 ± 0.016 mas (21.7 standard errors), is not used. Radius 10.0403 +/- 0.2787 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214939852 (K2 campaign 7): PARAM radius (solar radii) 10.040277 (16th-84th percentiles 9.777668-10.335133), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8724 +/- 0.0506 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214939852 (K2 campaign 7): PARAM mass (solar masses) 0.872373 (16th-84th percentiles 0.827628-0.928794), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,057 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 214939852: APOGEE DR17 effective temperature 5056.7114 +/- 50 K (the catalogue's final uncertainty). log g 2.38 from the mass and radius.

**Colour.** A Planck spectrum at 5,057 K, because pARAM fits an extinction A_V = 0.74 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,057 K and log g 2.38 (u1 0.608, u2 0.162): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
