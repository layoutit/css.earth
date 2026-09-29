# EPIC 205223827

## Sources

Its oscillations, recorded in K2 campaign 2, give 1.18 solar masses and 12.0 solar radii; APOGEE spectra give 4,455 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4131406115215212928, distance 3,078 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205223827 (K2 campaign 2): PARAM asteroseismic distance (pc) 3078.085938 (16th-84th percentiles 2958.4375-3201.601562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.247 ± 0.026 mas (9.5 standard errors), is not used. Radius 12.0107 +/- 0.558 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205223827 (K2 campaign 2): PARAM radius (solar radii) 12.010708 (16th-84th percentiles 11.465407-12.581347), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1754 +/- 0.1249 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205223827 (K2 campaign 2): PARAM mass (solar masses) 1.17543 (16th-84th percentiles 1.056241-1.306004), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,455 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 205223827: APOGEE DR17 effective temperature 4455.072 +/- 50 K (the catalogue's final uncertainty). log g 2.35 from the mass and radius.

**Colour.** A Planck spectrum at 4,455 K, because pARAM fits an extinction A_V = 2.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,455 K and log g 2.35 (u1 0.791, u2 0.024): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
