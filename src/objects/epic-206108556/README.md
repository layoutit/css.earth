# EPIC 206108556

## Sources

Its oscillations, recorded in K2 campaign 3, give 1.50 solar masses and 11.8 solar radii; APOGEE spectra give 4,683 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2613637996486748544, distance 1,541 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206108556 (K2 campaign 3): PARAM asteroseismic distance (pc) 1541.386719 (16th-84th percentiles 1504.550781-1593.691406), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.622 ± 0.027 mas (23.0 standard errors), is not used. Radius 11.7699 +/- 0.4771 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206108556 (K2 campaign 3): PARAM radius (solar radii) 11.769851 (16th-84th percentiles 11.386476-12.340769), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4973 +/- 0.1398 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206108556 (K2 campaign 3): PARAM mass (solar masses) 1.497276 (16th-84th percentiles 1.396592-1.676093), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,683 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206108556: APOGEE DR17 effective temperature 4683.4614 +/- 50 K (the catalogue's final uncertainty). log g 2.47 from the mass and radius.

**Colour.** A Planck spectrum at 4,683 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,683 K and log g 2.47 (u1 0.720, u2 0.080): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
