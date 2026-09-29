# EPIC 249588192

## Sources

Its oscillations, recorded in K2 campaign 15, give 0.98 solar masses and 7.8 solar radii; GALAH spectra give 4,804 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6241674661868441216, distance 3,042 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249588192 (K2 campaign 15): PARAM asteroseismic distance (pc) 3042.265625 (16th-84th percentiles 2939.882812-3147.8125), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.322 ± 0.021 mas (15.6 standard errors), is not used. Radius 7.7948 +/- 0.3239 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249588192 (K2 campaign 15): PARAM radius (solar radii) 7.794786 (16th-84th percentiles 7.48105-8.128915), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9841 +/- 0.1005 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249588192 (K2 campaign 15): PARAM mass (solar masses) 0.984139 (16th-84th percentiles 0.889176-1.090268), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,804 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249588192: GALAH DR3 effective temperature 4804.1484 +/- 131 K (the catalogue's final uncertainty). log g 2.65 from the mass and radius.

**Colour.** A Planck spectrum at 4,804 K, because pARAM fits an extinction A_V = 0.54 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,804 K and log g 2.65 (u1 0.685, u2 0.106): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
