# EPIC 201567710

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.85 solar masses and 5.8 solar radii; APOGEE spectra give 4,840 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3796386124819004544, distance 3,537 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201567710 (K2 campaign 1): PARAM asteroseismic distance (pc) 3536.679688 (16th-84th percentiles 3464.84375-3622.96875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.296 ± 0.024 mas (12.2 standard errors), is not used. Radius 5.7963 +/- 0.1534 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201567710 (K2 campaign 1): PARAM radius (solar radii) 5.7963 (16th-84th percentiles 5.668465-5.975247), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8513 +/- 0.0575 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201567710 (K2 campaign 1): PARAM mass (solar masses) 0.851318 (16th-84th percentiles 0.80505-0.919969), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,840 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201567710: APOGEE DR17 effective temperature 4840.227 +/- 50 K (the catalogue's final uncertainty). log g 2.84 from the mass and radius.

**Colour.** A Planck spectrum at 4,840 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,840 K and log g 2.84 (u1 0.677, u2 0.111): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
