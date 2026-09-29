# EPIC 220446201

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.89 solar masses and 15.1 solar radii; APOGEE spectra give 4,738 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2553278622052521728, distance 3,065 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220446201 (K2 campaign 8): PARAM asteroseismic distance (pc) 3065.3125 (16th-84th percentiles 2918.75-3223.554688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.281 ± 0.017 mas (16.3 standard errors), is not used. Radius 15.0968 +/- 0.9355 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220446201 (K2 campaign 8): PARAM radius (solar radii) 15.09679 (16th-84th percentiles 14.247596-16.118659), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8946 +/- 0.1262 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220446201 (K2 campaign 8): PARAM mass (solar masses) 0.89463 (16th-84th percentiles 0.784397-1.036861), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,738 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220446201: APOGEE DR17 effective temperature 4738.1416 +/- 50 K (the catalogue's final uncertainty). log g 2.03 from the mass and radius.

**Colour.** A Planck spectrum at 4,738 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,738 K and log g 2.03 (u1 0.697, u2 0.098): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
