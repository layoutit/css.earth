# EPIC 211324215

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.10 solar masses and 9.2 solar radii; APOGEE spectra give 4,730 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 597776335691911424, distance 4,101 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211324215 (K2 campaign 5): PARAM asteroseismic distance (pc) 4101.015625 (16th-84th percentiles 3957.773438-4246.367188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.221 ± 0.019 mas (11.6 standard errors), is not used. Radius 9.2393 +/- 0.4079 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211324215 (K2 campaign 5): PARAM radius (solar radii) 9.239267 (16th-84th percentiles 8.838602-9.654447), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.096 +/- 0.1172 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211324215 (K2 campaign 5): PARAM mass (solar masses) 1.096022 (16th-84th percentiles 0.98413-1.218514), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,730 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211324215: APOGEE DR17 effective temperature 4729.7637 +/- 50 K (the catalogue's final uncertainty). log g 2.55 from the mass and radius.

**Colour.** A Planck spectrum at 4,730 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,730 K and log g 2.55 (u1 0.706, u2 0.091): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
