# EPIC 249662928

## Sources

Its oscillations, recorded in K2 campaign 15, give 0.98 solar masses and 10.2 solar radii; GALAH spectra give 4,733 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6253987714633177728, distance 4,083 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249662928 (K2 campaign 15): PARAM asteroseismic distance (pc) 4083.242188 (16th-84th percentiles 3999.023438-4159.804688), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.235 ± 0.017 mas (13.9 standard errors), is not used. Radius 10.2273 +/- 0.3181 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249662928 (K2 campaign 15): PARAM radius (solar radii) 10.227286 (16th-84th percentiles 9.898788-10.534985), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9807 +/- 0.0759 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249662928 (K2 campaign 15): PARAM mass (solar masses) 0.980663 (16th-84th percentiles 0.906825-1.05864), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,733 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249662928: GALAH DR3 effective temperature 4733.215 +/- 108 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Colour.** A Planck spectrum at 4,733 K, because pARAM fits an extinction A_V = 0.27 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,733 K and log g 2.41 (u1 0.703, u2 0.093): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
