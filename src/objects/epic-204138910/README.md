# EPIC 204138910

## Sources

Its oscillations, recorded in K2 campaign 2, give 1.05 solar masses and 9.0 solar radii; APOGEE spectra give 4,594 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 6236355602576888064, distance 2,342 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204138910 (K2 campaign 2): PARAM asteroseismic distance (pc) 2341.679688 (16th-84th percentiles 2283.730469-2397.929688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.381 ± 0.015 mas (24.8 standard errors), is not used. Radius 9.0201 +/- 0.3083 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204138910 (K2 campaign 2): PARAM radius (solar radii) 9.020115 (16th-84th percentiles 8.69683-9.313454), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0485 +/- 0.0823 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204138910 (K2 campaign 2): PARAM mass (solar masses) 1.048536 (16th-84th percentiles 0.961551-1.126176), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,594 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 204138910: APOGEE DR17 effective temperature 4593.736 +/- 50 K (the catalogue's final uncertainty). log g 2.55 from the mass and radius.

**Colour.** A Planck spectrum at 4,594 K, because pARAM fits an extinction A_V = 0.48 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,594 K and log g 2.55 (u1 0.750, u2 0.056): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
