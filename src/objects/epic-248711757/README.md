# EPIC 248711757

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.84 solar masses and 8.2 solar radii; APOGEE spectra give 4,751 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3866042419821274624, distance 3,716 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248711757 (K2 campaign 14): PARAM asteroseismic distance (pc) 3715.976562 (16th-84th percentiles 3646.875-3803.59375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.221 ± 0.018 mas (12.1 standard errors), is not used. Radius 8.182 +/- 0.2278 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248711757 (K2 campaign 14): PARAM radius (solar radii) 8.182043 (16th-84th percentiles 8.003695-8.459374), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8427 +/- 0.0571 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248711757 (K2 campaign 14): PARAM mass (solar masses) 0.842745 (16th-84th percentiles 0.800721-0.914937), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,751 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248711757: APOGEE DR17 effective temperature 4751.261 +/- 50 K (the catalogue's final uncertainty). log g 2.54 from the mass and radius.

**Colour.** A Planck spectrum at 4,751 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,751 K and log g 2.54 (u1 0.699, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
