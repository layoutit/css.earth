# EPIC 220599624

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.77 solar masses and 9.1 solar radii; APOGEE spectra give 4,803 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2578217843577462144, distance 3,496 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220599624 (K2 campaign 8): PARAM asteroseismic distance (pc) 3495.859375 (16th-84th percentiles 3446.796875-3558.359375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.215 ± 0.017 mas (13.0 standard errors), is not used. Radius 9.1022 +/- 0.2314 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220599624 (K2 campaign 8): PARAM radius (solar radii) 9.102246 (16th-84th percentiles 8.938042-9.400845), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7736 +/- 0.0465 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220599624 (K2 campaign 8): PARAM mass (solar masses) 0.773556 (16th-84th percentiles 0.745999-0.839056), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,803 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220599624: APOGEE DR17 effective temperature 4803.3413 +/- 50 K (the catalogue's final uncertainty). log g 2.41 from the mass and radius.

**Colour.** A Planck spectrum at 4,803 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,803 K and log g 2.41 (u1 0.682, u2 0.109): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
