# EPIC 212667932

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.79 solar masses and 10.6 solar radii; APOGEE spectra give 4,876 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3618723840547189120, distance 3,885 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667932 (K2 campaign 17): PARAM asteroseismic distance (pc) 3885 (16th-84th percentiles 3805.273438-3973.007812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.219 ± 0.016 mas (13.9 standard errors), is not used. Radius 10.6011 +/- 0.3116 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667932 (K2 campaign 17): PARAM radius (solar radii) 10.601146 (16th-84th percentiles 10.315555-10.938844), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7939 +/- 0.0523 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667932 (K2 campaign 17): PARAM mass (solar masses) 0.793853 (16th-84th percentiles 0.745036-0.849727), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,876 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212667932: APOGEE DR17 effective temperature 4876.282999999999 +/- 50 K (the catalogue's final uncertainty). log g 2.29 from the mass and radius.

**Colour.** A Planck spectrum at 4,876 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,876 K and log g 2.29 (u1 0.659, u2 0.125): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
