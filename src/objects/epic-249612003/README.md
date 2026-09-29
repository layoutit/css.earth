# EPIC 249612003

## Sources

Its oscillations, recorded in K2 campaign 15, give 1.04 solar masses and 13.6 solar radii; GALAH spectra give 4,272 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6256641622164703872, distance 1,910 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249612003 (K2 campaign 15): PARAM asteroseismic distance (pc) 1910.390625 (16th-84th percentiles 1831.464844-1992.539062), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.542 ± 0.019 mas (28.1 standard errors), is not used. Radius 13.5676 +/- 0.7141 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249612003 (K2 campaign 15): PARAM radius (solar radii) 13.567578 (16th-84th percentiles 12.889864-14.318008), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0442 +/- 0.1275 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249612003 (K2 campaign 15): PARAM mass (solar masses) 1.044246 (16th-84th percentiles 0.926819-1.181808), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,272 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 249612003: GALAH DR3 effective temperature 4271.9434 +/- 89 K (the catalogue's final uncertainty). log g 2.19 from the mass and radius.

**Colour.** A Planck spectrum at 4,272 K, because pARAM fits an extinction A_V = 0.52 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffd9b2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,272 K and log g 2.19 (u1 0.848, u2 -0.023): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
