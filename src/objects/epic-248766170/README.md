# EPIC 248766170

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.94 solar masses and 10.5 solar radii; APOGEE spectra give 4,870 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3867875511863244288, distance 3,318 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248766170 (K2 campaign 14): PARAM asteroseismic distance (pc) 3318.164062 (16th-84th percentiles 3248.75-3392.03125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.294 ± 0.015 mas (19.5 standard errors), is not used. Radius 10.5183 +/- 0.4106 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248766170 (K2 campaign 14): PARAM radius (solar radii) 10.518292 (16th-84th percentiles 10.125893-10.947056), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9437 +/- 0.0862 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248766170 (K2 campaign 14): PARAM mass (solar masses) 0.943718 (16th-84th percentiles 0.865564-1.038012), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,870 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248766170: APOGEE DR17 effective temperature 4869.587 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,870 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,870 K and log g 2.37 (u1 0.661, u2 0.124): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
