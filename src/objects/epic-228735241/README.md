# EPIC 228735241

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.03 solar masses and 6.2 solar radii; GALAH spectra give 4,753 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3581674971616460160, distance 2,728 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228735241 (K2 campaign 10): PARAM asteroseismic distance (pc) 2727.5 (16th-84th percentiles 2631.171875-2825.742188), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.360 ± 0.022 mas (16.5 standard errors), is not used. Radius 6.2101 +/- 0.2567 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228735241 (K2 campaign 10): PARAM radius (solar radii) 6.210075 (16th-84th percentiles 5.960391-6.473786), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0279 +/- 0.1023 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228735241 (K2 campaign 10): PARAM mass (solar masses) 1.027896 (16th-84th percentiles 0.930718-1.13541), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,753 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 228735241: GALAH DR3 effective temperature 4753.268 +/- 140 K (the catalogue's final uncertainty). log g 2.86 from the mass and radius.

**Colour.** A Planck spectrum at 4,753 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,753 K and log g 2.86 (u1 0.704, u2 0.091): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
