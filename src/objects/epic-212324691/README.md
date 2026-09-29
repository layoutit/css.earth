# EPIC 212324691

## Sources

Its oscillations, recorded in K2 campaign 6, give 1.14 solar masses and 7.3 solar radii; APOGEE spectra give 4,944 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3604246536584626048, distance 2,988 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212324691 (K2 campaign 6): PARAM asteroseismic distance (pc) 2988.203125 (16th-84th percentiles 2905.3125-3074.453125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.325 ± 0.017 mas (18.7 standard errors), is not used. Radius 7.2622 +/- 0.2592 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212324691 (K2 campaign 6): PARAM radius (solar radii) 7.262224 (16th-84th percentiles 7.009513-7.527828), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1404 +/- 0.0984 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212324691 (K2 campaign 6): PARAM mass (solar masses) 1.140387 (16th-84th percentiles 1.046918-1.24374), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,944 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212324691: APOGEE DR17 effective temperature 4943.5586 +/- 50 K (the catalogue's final uncertainty). log g 2.77 from the mass and radius.

**Colour.** A Planck spectrum at 4,944 K, because pARAM fits an extinction A_V = 0.28 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,944 K and log g 2.77 (u1 0.645, u2 0.136): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
