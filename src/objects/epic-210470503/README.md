# EPIC 210470503

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.48 solar masses and 13.4 solar radii; APOGEE spectra give 4,929 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 39821772834472832, distance 3,202 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210470503 (K2 campaign 4): PARAM asteroseismic distance (pc) 3202.34375 (16th-84th percentiles 3095.625-3334.804688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.356 ± 0.015 mas (23.5 standard errors), is not used. Radius 13.4031 +/- 0.6067 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210470503 (K2 campaign 4): PARAM radius (solar radii) 13.403096 (16th-84th percentiles 12.833765-14.047124), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4772 +/- 0.155 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210470503 (K2 campaign 4): PARAM mass (solar masses) 1.477209 (16th-84th percentiles 1.331789-1.641776), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,929 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210470503: APOGEE DR17 effective temperature 4929.2173 +/- 50 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Colour.** A Planck spectrum at 4,929 K, because pARAM fits an extinction A_V = 0.87 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,929 K and log g 2.35 (u1 0.644, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
