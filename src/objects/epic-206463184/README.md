# EPIC 206463184

## Sources

Its oscillations, recorded in K2 campaign 3, give 1.02 solar masses and 24.8 solar radii; APOGEE spectra give 4,315 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2624508936669609344, distance 5,670 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206463184 (K2 campaign 3): PARAM asteroseismic distance (pc) 5669.765625 (16th-84th percentiles 5294.765625-6128.59375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.217 ± 0.018 mas (12.0 standard errors), is not used. Radius 24.8366 +/- 2.1643 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206463184 (K2 campaign 3): PARAM radius (solar radii) 24.836572 (16th-84th percentiles 22.976911-27.30558), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0181 +/- 0.1906 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206463184 (K2 campaign 3): PARAM mass (solar masses) 1.018117 (16th-84th percentiles 0.862766-1.243973), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,315 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206463184: APOGEE DR17 effective temperature 4314.7246 +/- 50 K (the catalogue's final uncertainty). log g 1.66 from the mass and radius.

**Colour.** A Planck spectrum at 4,315 K, because pARAM fits an extinction A_V = 0.18 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,315 K and log g 1.66 (u1 0.831, u2 -0.007): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
