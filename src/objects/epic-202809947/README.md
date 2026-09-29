# EPIC 202809947

## Sources

Its oscillations, recorded in K2 campaign 2, give 0.85 solar masses and 16.1 solar radii; APOGEE spectra give 4,383 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6044977662358202368, distance 3,975 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 202809947 (K2 campaign 2): PARAM asteroseismic distance (pc) 3974.960938 (16th-84th percentiles 3898.28125-4066.5625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.243 ± 0.026 mas (9.5 standard errors), is not used. Radius 16.0757 +/- 0.4778 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 202809947 (K2 campaign 2): PARAM radius (solar radii) 16.075725 (16th-84th percentiles 15.697581-16.653134), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8461 +/- 0.0514 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 202809947 (K2 campaign 2): PARAM mass (solar masses) 0.846075 (16th-84th percentiles 0.811167-0.913878), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,383 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 202809947: APOGEE DR17 effective temperature 4382.9697 +/- 50 K (the catalogue's final uncertainty). log g 1.95 from the mass and radius.

**Colour.** A Planck spectrum at 4,383 K, because pARAM fits an extinction A_V = 2.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,383 K and log g 1.95 (u1 0.809, u2 0.010): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
