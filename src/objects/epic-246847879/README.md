# EPIC 246847879

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.22 solar masses and 9.3 solar radii; APOGEE spectra give 4,727 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3393937793579573504, distance 3,513 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246847879 (K2 campaign 13): PARAM asteroseismic distance (pc) 3513.320312 (16th-84th percentiles 3403.398438-3623.710938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, -0.222 ± 0.136 mas (-1.6 standard errors), is not used. Radius 9.2678 +/- 0.3908 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246847879 (K2 campaign 13): PARAM radius (solar radii) 9.267826 (16th-84th percentiles 8.873881-9.655463), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2249 +/- 0.1241 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246847879 (K2 campaign 13): PARAM mass (solar masses) 1.224894 (16th-84th percentiles 1.102081-1.350368), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,727 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246847879: APOGEE DR17 effective temperature 4726.567 +/- 50 K (the catalogue's final uncertainty). log g 2.59 from the mass and radius.

**Colour.** A Planck spectrum at 4,727 K, because pARAM fits an extinction A_V = 0.86 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,727 K and log g 2.59 (u1 0.708, u2 0.089): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
