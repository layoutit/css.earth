# EPIC 246054477

## Sources

Its oscillations, recorded in K2 campaign 12, give 0.83 solar masses and 7.5 solar radii; APOGEE spectra give 4,689 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2442084358300914432, distance 2,560 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246054477 (K2 campaign 12): PARAM asteroseismic distance (pc) 2559.628906 (16th-84th percentiles 2519.746094-2607.773438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.356 ± 0.016 mas (21.9 standard errors), is not used. Radius 7.4939 +/- 0.163 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246054477 (K2 campaign 12): PARAM radius (solar radii) 7.493869 (16th-84th percentiles 7.365613-7.691704), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8331 +/- 0.0422 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246054477 (K2 campaign 12): PARAM mass (solar masses) 0.833148 (16th-84th percentiles 0.80248-0.886804), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,689 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246054477: APOGEE DR17 effective temperature 4688.6924 +/- 50 K (the catalogue's final uncertainty). log g 2.61 from the mass and radius.

**Colour.** A Planck spectrum at 4,689 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,689 K and log g 2.61 (u1 0.720, u2 0.079): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
