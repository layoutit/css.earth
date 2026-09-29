# EPIC 251541838

## Sources

Its oscillations, recorded in K2 campaign 17, give 2.77 solar masses and 22.1 solar radii; APOGEE spectra give 5,264 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3638136783487291648, distance 14,708 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251541838 (K2 campaign 17): PARAM asteroseismic distance (pc) 14707.65625 (16th-84th percentiles 14443.59375-14956.71875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.147 ± 0.026 mas (5.6 standard errors), is not used. Radius 22.0881 +/- 0.5123 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251541838 (K2 campaign 17): PARAM radius (solar radii) 22.088109 (16th-84th percentiles 21.52138-22.546039), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.7675 +/- 0.1101 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251541838 (K2 campaign 17): PARAM mass (solar masses) 2.767499 (16th-84th percentiles 2.637814-2.85805), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,264 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251541838: APOGEE DR17 effective temperature 5264.306 +/- 66 K (the catalogue's final uncertainty). log g 2.19 from the mass and radius.

**Colour.** A Planck spectrum at 5,264 K, because pARAM fits an extinction A_V = -0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffead9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,264 K and log g 2.19 (u1 0.553, u2 0.198): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
