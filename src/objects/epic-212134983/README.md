# EPIC 212134983

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.42 solar masses and 9.1 solar radii; APOGEE spectra give 4,794 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 677877303964704128, distance 2,153 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212134983 (K2 campaign 5): PARAM asteroseismic distance (pc) 2152.65625 (16th-84th percentiles 2090.273438-2217.636719), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.474 ± 0.015 mas (31.2 standard errors), is not used. Radius 9.0651 +/- 0.3504 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212134983 (K2 campaign 5): PARAM radius (solar radii) 9.065093 (16th-84th percentiles 8.728618-9.429357), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.4156 +/- 0.1294 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212134983 (K2 campaign 5): PARAM mass (solar masses) 1.415582 (16th-84th percentiles 1.293839-1.55267), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,794 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212134983: APOGEE DR17 effective temperature 4794.3066 +/- 50 K (the catalogue's final uncertainty). log g 2.67 from the mass and radius.

**Colour.** A Planck spectrum at 4,794 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,794 K and log g 2.67 (u1 0.688, u2 0.104): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
