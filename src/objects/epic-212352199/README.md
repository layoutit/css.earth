# EPIC 212352199

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.89 solar masses and 10.2 solar radii; APOGEE spectra give 4,552 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3605292172142589184, distance 3,550 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352199 (K2 campaign 6): PARAM asteroseismic distance (pc) 3550.234375 (16th-84th percentiles 3474.375-3648.828125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.210 ± 0.019 mas (11.2 standard errors), is not used. Radius 10.2484 +/- 0.3482 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352199 (K2 campaign 6): PARAM radius (solar radii) 10.248353 (16th-84th percentiles 9.964466-10.660871), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.885 +/- 0.0706 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352199 (K2 campaign 6): PARAM mass (solar masses) 0.884961 (16th-84th percentiles 0.8301-0.971204), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,552 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352199: APOGEE DR17 effective temperature 4552.246 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,552 K, because pARAM fits an extinction A_V = 0.30 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,552 K and log g 2.36 (u1 0.761, u2 0.048): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
