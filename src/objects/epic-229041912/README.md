# EPIC 229041912

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.28 solar masses and 11.4 solar radii; APOGEE spectra give 4,966 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3696414125279525248, distance 2,950 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229041912 (K2 campaign 10): PARAM asteroseismic distance (pc) 2950.039062 (16th-84th percentiles 2875.820312-3001.015625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.393 ± 0.017 mas (22.8 standard errors), is not used. Radius 11.3664 +/- 0.6477 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229041912 (K2 campaign 10): PARAM radius (solar radii) 11.366391 (16th-84th percentiles 10.53042-11.825801), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.277 +/- 0.1663 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229041912 (K2 campaign 10): PARAM mass (solar masses) 1.277037 (16th-84th percentiles 1.081618-1.414275), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,966 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229041912: APOGEE DR17 effective temperature 4965.748 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 4,966 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,966 K and log g 2.43 (u1 0.634, u2 0.144): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
