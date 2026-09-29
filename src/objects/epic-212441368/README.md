# EPIC 212441368

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.37 solar masses and 23.2 solar radii; APOGEE spectra give 4,747 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3608970725732387072, distance 6,801 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212441368 (K2 campaign 6): PARAM asteroseismic distance (pc) 6801.40625 (16th-84th percentiles 6397.65625-7238.125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.127 ± 0.016 mas (7.7 standard errors), is not used. Radius 23.2211 +/- 1.9697 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212441368 (K2 campaign 6): PARAM radius (solar radii) 23.221117 (16th-84th percentiles 21.338431-25.27787), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3672 +/- 0.2507 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212441368 (K2 campaign 6): PARAM mass (solar masses) 1.367247 (16th-84th percentiles 1.137475-1.63892), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,747 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212441368: APOGEE DR17 effective temperature 4747.4556 +/- 50 K (the catalogue's final uncertainty). log g 1.84 from the mass and radius.

**Colour.** A Planck spectrum at 4,747 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,747 K and log g 1.84 (u1 0.692, u2 0.101): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
