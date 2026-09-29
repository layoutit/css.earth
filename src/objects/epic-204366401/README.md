# EPIC 204366401

## Sources

Its oscillations, recorded in K2 campaign 11, give 0.91 solar masses and 12.5 solar radii; APOGEE spectra give 4,351 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4125919277329821568, distance 2,983 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204366401 (K2 campaign 11): PARAM asteroseismic distance (pc) 2982.617188 (16th-84th percentiles 2931.5625-3046.210938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.289 ± 0.022 mas (13.4 standard errors), is not used. Radius 12.5468 +/- 0.3833 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204366401 (K2 campaign 11): PARAM radius (solar radii) 12.546819 (16th-84th percentiles 12.251671-13.018265), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9107 +/- 0.0627 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204366401 (K2 campaign 11): PARAM mass (solar masses) 0.910714 (16th-84th percentiles 0.865924-0.991406), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,351 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204366401: APOGEE DR17 effective temperature 4351.486 +/- 50 K (the catalogue's final uncertainty). log g 2.2 from the mass and radius.

**Colour.** A Planck spectrum at 4,351 K, because pARAM fits an extinction A_V = 0.97 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdbb5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,351 K and log g 2.2 (u1 0.823, u2 -0.002): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
