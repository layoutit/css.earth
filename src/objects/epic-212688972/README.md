# EPIC 212688972

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.86 solar masses and 10.4 solar radii; APOGEE spectra give 5,035 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3618249607438246912, distance 4,948 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212688972 (K2 campaign 17): PARAM asteroseismic distance (pc) 4947.65625 (16th-84th percentiles 4767.929688-5134.0625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.203 ± 0.021 mas (9.6 standard errors), is not used. Radius 10.4407 +/- 0.5075 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212688972 (K2 campaign 17): PARAM radius (solar radii) 10.440656 (16th-84th percentiles 9.957632-10.972612), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8611 +/- 0.0993 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212688972 (K2 campaign 17): PARAM mass (solar masses) 0.861051 (16th-84th percentiles 0.768817-0.967425), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,035 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212688972: APOGEE DR17 effective temperature 5035.4717 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 5,035 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,035 K and log g 2.34 (u1 0.613, u2 0.158): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
