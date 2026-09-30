# EPIC 206375262

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.82 solar masses and 17.0 solar radii; APOGEE spectra give 4,612 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2622461332485650944, distance 7,146 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206375262 (K2 campaign 3): PARAM asteroseismic distance (pc) 7145.9375 (16th-84th percentiles 6930.859375-7444.375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.153 ± 0.020 mas (7.6 standard errors), is not used. Radius 17.0374 +/- 0.8563 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206375262 (K2 campaign 3): PARAM radius (solar radii) 17.03742 (16th-84th percentiles 16.366278-18.078959), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8172 +/- 0.0913 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206375262 (K2 campaign 3): PARAM mass (solar masses) 0.817221 (16th-84th percentiles 0.748768-0.931462), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,612 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206375262: APOGEE DR17 effective temperature 4611.594 +/- 50 K (the catalogue's final uncertainty). log g 1.89 from the mass and radius.

**Colour.** A Planck spectrum at 4,612 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,612 K and log g 1.89 (u1 0.735, u2 0.069): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
