# EPIC 212592995

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.84 solar masses and 12.4 solar radii; APOGEE spectra give 4,904 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3616733999378932224, distance 7,037 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212592995 (K2 campaign 6): PARAM asteroseismic distance (pc) 7037.1875 (16th-84th percentiles 6799.609375-7376.09375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.103 ± 0.023 mas (4.5 standard errors), is not used. Radius 12.4497 +/- 0.7108 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212592995 (K2 campaign 6): PARAM radius (solar radii) 12.449739 (16th-84th percentiles 11.891211-13.312875), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8438 +/- 0.1145 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212592995 (K2 campaign 6): PARAM mass (solar masses) 0.843765 (16th-84th percentiles 0.756887-0.985928), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,904 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212592995: APOGEE DR17 effective temperature 4904.33 +/- 136 K (the catalogue's final uncertainty). log g 2.17 from the mass and radius.

**Colour.** A Planck spectrum at 4,904 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,904 K and log g 2.17 (u1 0.649, u2 0.132): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
