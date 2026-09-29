# EPIC 211914760

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.97 solar masses and 5.2 solar radii; GALAH spectra give 4,882 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 612412690883838592, distance 2,323 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211914760 (K2 campaign 5): PARAM asteroseismic distance (pc) 2322.929688 (16th-84th percentiles 2236.5625-2411.132812), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.346 ± 0.021 mas (16.8 standard errors), is not used. Radius 5.2264 +/- 0.2078 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211914760 (K2 campaign 5): PARAM radius (solar radii) 5.226361 (16th-84th percentiles 5.026387-5.442034), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9744 +/- 0.0951 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211914760 (K2 campaign 5): PARAM mass (solar masses) 0.974431 (16th-84th percentiles 0.885032-1.075163), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,882 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211914760: GALAH DR3 effective temperature 4881.5054 +/- 347 K (the catalogue's final uncertainty). log g 2.99 from the mass and radius.

**Colour.** A Planck spectrum at 4,882 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,882 K and log g 2.99 (u1 0.667, u2 0.119): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
