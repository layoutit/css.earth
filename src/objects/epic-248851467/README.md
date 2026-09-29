# EPIC 248851467

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.97 solar masses and 5.4 solar radii; APOGEE spectra give 5,003 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3871733732524803072, distance 1,733 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248851467 (K2 campaign 14): PARAM asteroseismic distance (pc) 1733.105469 (16th-84th percentiles 1691.660156-1774.960938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.591 ± 0.017 mas (34.2 standard errors), is not used. Radius 5.3853 +/- 0.1645 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248851467 (K2 campaign 14): PARAM radius (solar radii) 5.385345 (16th-84th percentiles 5.224907-5.553907), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9731 +/- 0.0677 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248851467 (K2 campaign 14): PARAM mass (solar masses) 0.973148 (16th-84th percentiles 0.907389-1.042837), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,003 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248851467: APOGEE DR17 effective temperature 5003.0674 +/- 50 K (the catalogue's final uncertainty). log g 2.96 from the mass and radius.

**Colour.** A Planck spectrum at 5,003 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,003 K and log g 2.96 (u1 0.630, u2 0.147): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
