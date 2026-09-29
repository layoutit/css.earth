# EPIC 206123368

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.92 solar masses and 10.7 solar radii; APOGEE spectra give 4,722 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2613715958733140096, distance 3,774 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206123368 (K2 campaign 3): PARAM asteroseismic distance (pc) 3773.515625 (16th-84th percentiles 3689.453125-3861.601562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.281 ± 0.018 mas (15.7 standard errors), is not used. Radius 10.6593 +/- 0.3301 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206123368 (K2 campaign 3): PARAM radius (solar radii) 10.659326 (16th-84th percentiles 10.35018-11.010413), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9155 +/- 0.0658 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206123368 (K2 campaign 3): PARAM mass (solar masses) 0.915454 (16th-84th percentiles 0.853315-0.984823), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,722 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206123368: APOGEE DR17 effective temperature 4722.407 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 4,722 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,722 K and log g 2.34 (u1 0.706, u2 0.091): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
