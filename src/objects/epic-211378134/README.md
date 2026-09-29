# EPIC 211378134

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.07 solar masses and 8.3 solar radii; APOGEE spectra give 4,600 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 598891068683719936, distance 5,437 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211378134 (K2 campaign 5): PARAM asteroseismic distance (pc) 5437.1875 (16th-84th percentiles 5308.671875-5587.109375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.155 ± 0.034 mas (4.6 standard errors), is not used. Radius 8.3141 +/- 0.2881 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211378134 (K2 campaign 5): PARAM radius (solar radii) 8.314067 (16th-84th percentiles 8.068388-8.644557), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0732 +/- 0.0905 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211378134 (K2 campaign 5): PARAM mass (solar masses) 1.073231 (16th-84th percentiles 1.002761-1.183687), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,600 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211378134: APOGEE DR17 effective temperature 4600.405 +/- 50 K (the catalogue's final uncertainty). log g 2.63 from the mass and radius.

**Colour.** A Planck spectrum at 4,600 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,600 K and log g 2.63 (u1 0.749, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
