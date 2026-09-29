# EPIC 212709771

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.79 solar masses and 14.5 solar radii; APOGEE spectra give 4,775 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3619053487877076352, distance 6,650 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212709771 (K2 campaign 17): PARAM asteroseismic distance (pc) 6649.6875 (16th-84th percentiles 6483.59375-6875.078125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.120 ± 0.021 mas (5.6 standard errors), is not used. Radius 14.5224 +/- 0.6243 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212709771 (K2 campaign 17): PARAM radius (solar radii) 14.52241 (16th-84th percentiles 14.036409-15.284972), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7871 +/- 0.0772 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212709771 (K2 campaign 17): PARAM mass (solar masses) 0.787077 (16th-84th percentiles 0.73098-0.885461), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,775 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212709771: APOGEE DR17 effective temperature 4774.7197 +/- 50 K (the catalogue's final uncertainty). log g 2.01 from the mass and radius.

**Colour.** A Planck spectrum at 4,775 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,775 K and log g 2.01 (u1 0.685, u2 0.106): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
