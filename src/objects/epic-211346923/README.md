# EPIC 211346923

## Sources

Its oscillations, recorded in K2 campaign 5, give 0.83 solar masses and 6.4 solar radii; APOGEE spectra give 4,829 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 598638043570291200, distance 3,383 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211346923 (K2 campaign 5): PARAM asteroseismic distance (pc) 3382.65625 (16th-84th percentiles 3323.75-3457.5), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.262 ± 0.021 mas (12.6 standard errors), is not used. Radius 6.412 +/- 0.1658 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211346923 (K2 campaign 5): PARAM radius (solar radii) 6.412 (16th-84th percentiles 6.275862-6.607458), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8306 +/- 0.0515 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211346923 (K2 campaign 5): PARAM mass (solar masses) 0.830572 (16th-84th percentiles 0.789713-0.892627), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,829 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211346923: APOGEE DR17 effective temperature 4829.083 +/- 50 K (the catalogue's final uncertainty). log g 2.74 from the mass and radius.

**Colour.** A Planck spectrum at 4,829 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,829 K and log g 2.74 (u1 0.679, u2 0.110): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
