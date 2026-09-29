# EPIC 212227997

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.86 solar masses and 9.6 solar radii; APOGEE spectra give 5,034 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 690833399230556416, distance 3,328 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212227997 (K2 campaign 16): PARAM asteroseismic distance (pc) 3327.851562 (16th-84th percentiles 3263.359375-3403.242188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.287 ± 0.017 mas (17.0 standard errors), is not used. Radius 9.6356 +/- 0.2895 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212227997 (K2 campaign 16): PARAM radius (solar radii) 9.635593 (16th-84th percentiles 9.390147-9.969103), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8558 +/- 0.0675 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212227997 (K2 campaign 16): PARAM mass (solar masses) 0.855762 (16th-84th percentiles 0.798819-0.933895), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,034 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212227997: APOGEE DR17 effective temperature 5034.379 +/- 50 K (the catalogue's final uncertainty). log g 2.4 from the mass and radius.

**Colour.** A Planck spectrum at 5,034 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,034 K and log g 2.4 (u1 0.614, u2 0.158): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
