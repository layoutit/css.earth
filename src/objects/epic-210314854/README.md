# EPIC 210314854

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.90 solar masses and 9.8 solar radii; APOGEE spectra give 4,810 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3303241518946672768, distance 1,267 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210314854 (K2 campaign 4): PARAM asteroseismic distance (pc) 1266.484375 (16th-84th percentiles 1242.246094-1294.042969), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.883 ± 0.031 mas (28.1 standard errors), is not used. Radius 9.8028 +/- 0.2723 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210314854 (K2 campaign 4): PARAM radius (solar radii) 9.802782 (16th-84th percentiles 9.567204-10.111761), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8986 +/- 0.0612 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210314854 (K2 campaign 4): PARAM mass (solar masses) 0.898585 (16th-84th percentiles 0.847197-0.969651), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,810 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210314854: APOGEE DR17 effective temperature 4809.6797 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Colour.** A Planck spectrum at 4,810 K, because pARAM fits an extinction A_V = 0.64 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,810 K and log g 2.41 (u1 0.680, u2 0.110): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
