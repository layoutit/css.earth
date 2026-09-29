# EPIC 210379805

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.90 solar masses and 11.8 solar radii; APOGEE spectra give 4,819 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 38574961008617856, distance 2,144 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210379805 (K2 campaign 4): PARAM asteroseismic distance (pc) 2144.121094 (16th-84th percentiles 2092.128906-2197.265625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.521 ± 0.015 mas (33.9 standard errors), is not used. Radius 11.7684 +/- 0.4193 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210379805 (K2 campaign 4): PARAM radius (solar radii) 11.76844 (16th-84th percentiles 11.36664-12.205159), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9014 +/- 0.0736 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210379805 (K2 campaign 4): PARAM mass (solar masses) 0.90137 (16th-84th percentiles 0.833607-0.980811), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,819 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210379805: APOGEE DR17 effective temperature 4819.4253 +/- 50 K (the catalogue's final uncertainty). log g 2.25 from the mass and radius.

**Colour.** A Planck spectrum at 4,819 K, because pARAM fits an extinction A_V = 0.89 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,819 K and log g 2.25 (u1 0.675, u2 0.114): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
