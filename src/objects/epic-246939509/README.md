# EPIC 246939509

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.42 solar masses and 7.9 solar radii; APOGEE spectra give 4,981 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3409229045384978432, distance 2,012 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246939509 (K2 campaign 13): PARAM asteroseismic distance (pc) 2012.207031 (16th-84th percentiles 1957.753906-2069.492188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.511 ± 0.017 mas (29.9 standard errors), is not used. Radius 7.8514 +/- 0.2759 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246939509 (K2 campaign 13): PARAM radius (solar radii) 7.851441 (16th-84th percentiles 7.580344-8.13219), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4201 +/- 0.1178 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246939509 (K2 campaign 13): PARAM mass (solar masses) 1.420076 (16th-84th percentiles 1.30734-1.542874), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,981 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246939509: APOGEE DR17 effective temperature 4981.4175 +/- 50 K (the catalogue's final uncertainty). log g 2.8 from the mass and radius.

**Colour.** A Planck spectrum at 4,981 K, because pARAM fits an extinction A_V = 1.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,981 K and log g 2.8 (u1 0.634, u2 0.144): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
