# EPIC 247564120

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.48 solar masses and 11.8 solar radii; APOGEE spectra give 4,957 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3412509610125383552, distance 4,861 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247564120 (K2 campaign 13): PARAM asteroseismic distance (pc) 4860.585938 (16th-84th percentiles 4793.90625-4942.578125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.163 ± 0.029 mas (5.7 standard errors), is not used. Radius 11.8492 +/- 0.3268 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247564120 (K2 campaign 13): PARAM radius (solar radii) 11.849195 (16th-84th percentiles 11.644996-12.298526), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4756 +/- 0.1016 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247564120 (K2 campaign 13): PARAM mass (solar masses) 1.475554 (16th-84th percentiles 1.386818-1.590054), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,957 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247564120: APOGEE DR17 effective temperature 4957.391 +/- 50 K (the catalogue's final uncertainty). log g 2.46 from the mass and radius.

**Colour.** A Planck spectrum at 4,957 K, because pARAM fits an extinction A_V = 1.35 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,957 K and log g 2.46 (u1 0.637, u2 0.142): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
