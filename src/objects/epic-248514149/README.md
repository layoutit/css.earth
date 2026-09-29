# EPIC 248514149

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.81 solar masses and 8.7 solar radii; APOGEE spectra give 4,762 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3857663694541045504, distance 1,308 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248514149 (K2 campaign 14): PARAM asteroseismic distance (pc) 1307.949219 (16th-84th percentiles 1284.902344-1338.007812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.720 ± 0.018 mas (40.7 standard errors), is not used. Radius 8.6739 +/- 0.2469 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248514149 (K2 campaign 14): PARAM radius (solar radii) 8.673909 (16th-84th percentiles 8.481925-8.975697), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8147 +/- 0.056 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248514149 (K2 campaign 14): PARAM mass (solar masses) 0.814656 (16th-84th percentiles 0.774913-0.886986), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,762 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248514149: APOGEE DR17 effective temperature 4761.585999999998 +/- 50 K (the catalogue's final uncertainty). log g 2.47 from the mass and radius.

**Colour.** A Planck spectrum at 4,762 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,762 K and log g 2.47 (u1 0.695, u2 0.100): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
