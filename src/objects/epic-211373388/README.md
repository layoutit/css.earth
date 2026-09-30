# EPIC 211373388

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.81 solar masses and 7.9 solar radii; APOGEE spectra give 4,800 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 604680341001282560, distance 4,146 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211373388 (K2 campaign 5): PARAM asteroseismic distance (pc) 4146.328125 (16th-84th percentiles 4062.617188-4248.125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.180 ± 0.021 mas (8.7 standard errors), is not used. Radius 7.8971 +/- 0.2349 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211373388 (K2 campaign 5): PARAM radius (solar radii) 7.897056 (16th-84th percentiles 7.703281-8.173066), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8102 +/- 0.0587 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211373388 (K2 campaign 5): PARAM mass (solar masses) 0.810246 (16th-84th percentiles 0.763079-0.880457), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,800 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211373388: APOGEE DR17 effective temperature 4800.184 +/- 50 K (the catalogue's final uncertainty). log g 2.55 from the mass and radius.

**Colour.** A Planck spectrum at 4,800 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,800 K and log g 2.55 (u1 0.685, u2 0.107): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
