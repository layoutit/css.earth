# EPIC 212335603

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.00 solar masses and 8.6 solar radii; APOGEE spectra give 4,756 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3604468500494397184, distance 1,114 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335603 (K2 campaign 6): PARAM asteroseismic distance (pc) 1113.994141 (16th-84th percentiles 1078.408203-1150.087891), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.921 ± 0.023 mas (39.2 standard errors), is not used. Radius 8.607 +/- 0.349 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335603 (K2 campaign 6): PARAM radius (solar radii) 8.606954 (16th-84th percentiles 8.265361-8.963369), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0028 +/- 0.0985 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335603 (K2 campaign 6): PARAM mass (solar masses) 1.00279 (16th-84th percentiles 0.908449-1.105353), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,756 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212335603: APOGEE DR17 effective temperature 4756.3003 +/- 50 K (the catalogue's final uncertainty). log g 2.57 from the mass and radius.

**Colour.** A Planck spectrum at 4,756 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,756 K and log g 2.57 (u1 0.698, u2 0.097): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
