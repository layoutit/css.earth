# EPIC 246290412

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.84 solar masses and 14.6 solar radii; APOGEE spectra give 4,497 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2640258856622056320, distance 3,058 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246290412 (K2 campaign 12): PARAM asteroseismic distance (pc) 3058.046875 (16th-84th percentiles 2997.226562-3136.601562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.294 ± 0.020 mas (14.4 standard errors), is not used. Radius 14.5751 +/- 0.5009 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246290412 (K2 campaign 12): PARAM radius (solar radii) 14.575104 (16th-84th percentiles 14.185659-15.187415), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8433 +/- 0.0649 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246290412 (K2 campaign 12): PARAM mass (solar masses) 0.843267 (16th-84th percentiles 0.796366-0.926096), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,497 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246290412: APOGEE DR17 effective temperature 4496.797000000001 +/- 50 K (the catalogue's final uncertainty). log g 2.04 from the mass and radius.

**Colour.** A Planck spectrum at 4,497 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,497 K and log g 2.04 (u1 0.772, u2 0.041): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
