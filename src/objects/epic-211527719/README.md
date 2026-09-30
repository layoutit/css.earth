# EPIC 211527719

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.93 solar masses and 9.9 solar radii; GALAH spectra give 4,859 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 650464726738522112, distance 6,585 pc from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211527719 (K2 campaign 5): PARAM asteroseismic distance (pc) 6584.6875 (16th-84th percentiles 6392.34375-6747.96875), MA09 pipeline with GALAH DR3; Gaia DR3's parallax, 0.148 ± 0.029 mas (5.1 standard errors), is not used. Radius 9.889 +/- 0.3505 solar radii from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211527719 (K2 campaign 5): PARAM radius (solar radii) 9.889047 (16th-84th percentiles 9.510522-10.211608), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9344 +/- 0.0783 solar masses from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211527719 (K2 campaign 5): PARAM mass (solar masses) 0.934416 (16th-84th percentiles 0.855616-1.01214), MA09 pipeline with GALAH DR3 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,859 K from Khan et al. (2023), A&A 677, A21, k2_gal, EPIC 211527719: GALAH DR3 effective temperature 4858.9478 +/- 146 K (the catalogue's final uncertainty). log g 2.42 from the mass and radius.

**Colour.** A Planck spectrum at 4,859 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_gal, AV-M), and the colour routes do not remove extinction; GALAH measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,859 K and log g 2.42 (u1 0.665, u2 0.121): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
