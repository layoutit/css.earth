# EPIC 245963682

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.99 solar masses and 10.2 solar radii; APOGEE spectra give 4,936 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2413780283301657856, distance 2,812 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245963682 (K2 campaign 12): PARAM asteroseismic distance (pc) 2811.992188 (16th-84th percentiles 2775.585938-2849.726562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.318 ± 0.017 mas (19.2 standard errors), is not used. Radius 10.2348 +/- 0.3342 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245963682 (K2 campaign 12): PARAM radius (solar radii) 10.234795 (16th-84th percentiles 10.024977-10.693452), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9912 +/- 0.0745 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245963682 (K2 campaign 12): PARAM mass (solar masses) 0.991181 (16th-84th percentiles 0.94255-1.091572), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,936 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 245963682: APOGEE DR17 effective temperature 4935.946 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Colour.** A Planck spectrum at 4,936 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,936 K and log g 2.41 (u1 0.642, u2 0.138): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
