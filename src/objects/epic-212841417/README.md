# EPIC 212841417

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.08 solar masses and 10.3 solar radii; APOGEE spectra give 4,706 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3633231552878017024, distance 4,971 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212841417 (K2 campaign 17): PARAM asteroseismic distance (pc) 4970.820312 (16th-84th percentiles 4844.84375-5098.828125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.202 ± 0.024 mas (8.5 standard errors), is not used. Radius 10.2984 +/- 0.3611 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212841417 (K2 campaign 17): PARAM radius (solar radii) 10.298404 (16th-84th percentiles 9.939882-10.66208), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0825 +/- 0.0864 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212841417 (K2 campaign 17): PARAM mass (solar masses) 1.082464 (16th-84th percentiles 0.998021-1.170738), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,706 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212841417: APOGEE DR17 effective temperature 4706.473 +/- 50 K (the catalogue's final uncertainty). log g 2.45 from the mass and radius.

**Colour.** A Planck spectrum at 4,706 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,706 K and log g 2.45 (u1 0.712, u2 0.086): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
