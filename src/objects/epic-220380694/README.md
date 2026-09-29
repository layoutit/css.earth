# EPIC 220380694

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.77 solar masses and 10.5 solar radii; APOGEE spectra give 5,047 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2552479547682078592, distance 4,101 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220380694 (K2 campaign 8): PARAM asteroseismic distance (pc) 4100.585938 (16th-84th percentiles 4055.273438-4146.054688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.210 ± 0.019 mas (11.2 standard errors), is not used. Radius 10.464 +/- 0.152 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220380694 (K2 campaign 8): PARAM radius (solar radii) 10.463984 (16th-84th percentiles 10.325648-10.6296), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7708 +/- 0.0218 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220380694 (K2 campaign 8): PARAM mass (solar masses) 0.770751 (16th-84th percentiles 0.753964-0.797636), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,047 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220380694: APOGEE DR17 effective temperature 5047.045 +/- 50 K (the catalogue's final uncertainty). log g 2.29 from the mass and radius.

**Colour.** A Planck spectrum at 5,047 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,047 K and log g 2.29 (u1 0.610, u2 0.160): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
