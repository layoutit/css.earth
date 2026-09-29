# EPIC 212095972

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.99 solar masses and 8.8 solar radii; APOGEE spectra give 4,697 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 665730861573728896, distance 3,389 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212095972 (K2 campaign 5): PARAM asteroseismic distance (pc) 3389.414062 (16th-84th percentiles 3267.109375-3516.484375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.266 ± 0.021 mas (12.4 standard errors), is not used. Radius 8.7869 +/- 0.3819 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212095972 (K2 campaign 5): PARAM radius (solar radii) 8.786858 (16th-84th percentiles 8.42207-9.185774), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9867 +/- 0.1038 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212095972 (K2 campaign 5): PARAM mass (solar masses) 0.986729 (16th-84th percentiles 0.890144-1.09776), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,697 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212095972: APOGEE DR17 effective temperature 4697.378 +/- 50 K (the catalogue's final uncertainty). log g 2.54 from the mass and radius.

**Colour.** A Planck spectrum at 4,697 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,697 K and log g 2.54 (u1 0.716, u2 0.082): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
