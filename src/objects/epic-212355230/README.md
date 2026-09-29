# EPIC 212355230

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.79 solar masses and 11.4 solar radii; APOGEE spectra give 4,671 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3605260664262466688, distance 4,792 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212355230 (K2 campaign 6): PARAM asteroseismic distance (pc) 4792.070312 (16th-84th percentiles 4715-4883.515625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.180 ± 0.020 mas (9.0 standard errors), is not used. Radius 11.3678 +/- 0.2841 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212355230 (K2 campaign 6): PARAM radius (solar radii) 11.367782 (16th-84th percentiles 11.14678-11.71507), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7884 +/- 0.0436 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212355230 (K2 campaign 6): PARAM mass (solar masses) 0.788436 (16th-84th percentiles 0.758672-0.845923), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,671 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212355230: APOGEE DR17 effective temperature 4670.9443 +/- 50 K (the catalogue's final uncertainty). log g 2.22 from the mass and radius.

**Colour.** A Planck spectrum at 4,671 K, because pARAM fits an extinction A_V = 0.25 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,671 K and log g 2.22 (u1 0.720, u2 0.080): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
