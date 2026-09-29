# EPIC 206013839

## Sources

Its oscillations, recorded in K2 campaign 3, give 0.83 solar masses and 9.8 solar radii; APOGEE spectra give 5,040 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2597134979788726528, distance 3,326 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206013839 (K2 campaign 3): PARAM asteroseismic distance (pc) 3326.09375 (16th-84th percentiles 3271.328125-3381.210938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.298 ± 0.014 mas (20.6 standard errors), is not used. Radius 9.7892 +/- 0.2317 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206013839 (K2 campaign 3): PARAM radius (solar radii) 9.789194 (16th-84th percentiles 9.584182-10.047597), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8275 +/- 0.0416 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206013839 (K2 campaign 3): PARAM mass (solar masses) 0.827489 (16th-84th percentiles 0.791789-0.875074), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,040 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 206013839: APOGEE DR17 effective temperature 5040.1577 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 5,040 K, because pARAM fits an extinction A_V = 0.08 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,040 K and log g 2.37 (u1 0.612, u2 0.159): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
