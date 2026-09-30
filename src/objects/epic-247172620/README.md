# EPIC 247172620

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.09 solar masses and 10.6 solar radii; GALAH spectra give 4,737 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3410524235722372608, distance 3,097 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247172620 (K2 campaign 13): PARAM asteroseismic distance (pc) 3096.992188 (16th-84th percentiles 3002.304688-3406.601562), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.322 ± 0.017 mas (18.5 standard errors), is not used. Radius 10.639 +/- 0.7087 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247172620 (K2 campaign 13): PARAM radius (solar radii) 10.639046 (16th-84th percentiles 10.166016-11.58342), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0935 +/- 0.1648 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247172620 (K2 campaign 13): PARAM mass (solar masses) 1.093549 (16th-84th percentiles 0.978917-1.30848), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,737 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 247172620: GALAH DR3 effective temperature 4737.206 +/- 127 K (the catalogue's final uncertainty). log g 2.42 from the mass and radius.

**Colour.** A Planck spectrum at 4,737 K, because pARAM fits an extinction A_V = 0.31 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,737 K and log g 2.42 (u1 0.702, u2 0.094): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
