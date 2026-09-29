# EPIC 248865966

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.82 solar masses and 9.8 solar radii; APOGEE spectra give 4,846 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3872376293991840640, distance 5,523 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248865966 (K2 campaign 14): PARAM asteroseismic distance (pc) 5523.046875 (16th-84th percentiles 5392.421875-5710.078125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.097 ± 0.025 mas (3.8 standard errors), is not used. Radius 9.7629 +/- 0.4052 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248865966 (K2 campaign 14): PARAM radius (solar radii) 9.762871 (16th-84th percentiles 9.438938-10.249366), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8202 +/- 0.0792 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248865966 (K2 campaign 14): PARAM mass (solar masses) 0.8202 (16th-84th percentiles 0.762514-0.920963), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,846 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248865966: APOGEE DR17 effective temperature 4845.503 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,846 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,846 K and log g 2.37 (u1 0.669, u2 0.118): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
