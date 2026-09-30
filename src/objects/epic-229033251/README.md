# EPIC 229033251

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.02 solar masses and 15.5 solar radii; APOGEE spectra give 4,920 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3696402000587800192, distance 11,782 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229033251 (K2 campaign 10): PARAM asteroseismic distance (pc) 11781.875 (16th-84th percentiles 11380.9375-12222.65625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.067 ± 0.036 mas (1.8 standard errors), is not used. Radius 15.4818 +/- 0.8067 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229033251 (K2 campaign 10): PARAM radius (solar radii) 15.481776 (16th-84th percentiles 14.734044-16.347452), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0209 +/- 0.1145 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229033251 (K2 campaign 10): PARAM mass (solar masses) 1.02094 (16th-84th percentiles 0.920064-1.148979), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,920 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229033251: APOGEE DR17 effective temperature 4919.6484 +/- 50 K (the catalogue's final uncertainty). log g 2.07 from the mass and radius.

**Colour.** A Planck spectrum at 4,920 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,920 K and log g 2.07 (u1 0.644, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
