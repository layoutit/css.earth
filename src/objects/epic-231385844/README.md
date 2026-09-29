# EPIC 231385844

## Sources

Its oscillations, recorded in K2 campaign 11, give 1.04 solar masses and 8.6 solar radii; APOGEE spectra give 4,587 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4113980230326855936, distance 5,268 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231385844 (K2 campaign 11): PARAM asteroseismic distance (pc) 5267.5 (16th-84th percentiles 5039.140625-5448.203125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.103 ± 0.050 mas (2.0 standard errors), is not used. Radius 8.6391 +/- 0.3777 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231385844 (K2 campaign 11): PARAM radius (solar radii) 8.639091 (16th-84th percentiles 8.234985-8.990382), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0407 +/- 0.1064 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231385844 (K2 campaign 11): PARAM mass (solar masses) 1.040716 (16th-84th percentiles 0.923431-1.136176), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,587 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 231385844: APOGEE DR17 effective temperature 4587.4043 +/- 50 K (the catalogue's final uncertainty). log g 2.58 from the mass and radius.

**Colour.** A Planck spectrum at 4,587 K, because pARAM fits an extinction A_V = 1.63 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,587 K and log g 2.58 (u1 0.753, u2 0.053): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
