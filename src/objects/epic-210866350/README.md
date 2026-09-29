# EPIC 210866350

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.18 solar masses and 12.7 solar radii; APOGEE spectra give 4,881 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 58191107441165184, distance 3,450 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210866350 (K2 campaign 4): PARAM asteroseismic distance (pc) 3449.921875 (16th-84th percentiles 3368.28125-3537.226562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.279 ± 0.015 mas (19.0 standard errors), is not used. Radius 12.7333 +/- 0.6315 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210866350 (K2 campaign 4): PARAM radius (solar radii) 12.733322 (16th-84th percentiles 12.229942-13.492973), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.181 +/- 0.1399 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210866350 (K2 campaign 4): PARAM mass (solar masses) 1.181005 (16th-84th percentiles 1.067717-1.347431), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,881 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210866350: APOGEE DR17 effective temperature 4880.695 +/- 50 K (the catalogue's final uncertainty). log g 2.3 from the mass and radius.

**Colour.** A Planck spectrum at 4,881 K, because pARAM fits an extinction A_V = 0.60 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,881 K and log g 2.3 (u1 0.657, u2 0.126): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
