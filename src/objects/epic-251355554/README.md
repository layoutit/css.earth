# EPIC 251355554

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.85 solar masses and 7.7 solar radii; APOGEE spectra give 4,650 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 637778286696906880, distance 3,839 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251355554 (K2 campaign 16): PARAM asteroseismic distance (pc) 3839.335938 (16th-84th percentiles 3781.914062-3908.632812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.211 ± 0.025 mas (8.5 standard errors), is not used. Radius 7.6608 +/- 0.1738 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251355554 (K2 campaign 16): PARAM radius (solar radii) 7.660761 (16th-84th percentiles 7.526838-7.874454), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8511 +/- 0.045 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251355554 (K2 campaign 16): PARAM mass (solar masses) 0.851127 (16th-84th percentiles 0.819322-0.909242), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,650 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251355554: APOGEE DR17 effective temperature 4649.5586 +/- 50 K (the catalogue's final uncertainty). log g 2.6 from the mass and radius.

**Colour.** A Planck spectrum at 4,650 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,650 K and log g 2.6 (u1 0.733, u2 0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
