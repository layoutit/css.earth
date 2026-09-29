# EPIC 212643360

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.95 solar masses and 12.4 solar radii; APOGEE spectra give 4,478 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3615461550892092544, distance 2,571 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212643360 (K2 campaign 6): PARAM asteroseismic distance (pc) 2570.703125 (16th-84th percentiles 2480.703125-2675.3125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.399 ± 0.016 mas (24.5 standard errors), is not used. Radius 12.3806 +/- 0.5748 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212643360 (K2 campaign 6): PARAM radius (solar radii) 12.380645 (16th-84th percentiles 11.875205-13.02482), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9543 +/- 0.1026 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212643360 (K2 campaign 6): PARAM mass (solar masses) 0.95427 (16th-84th percentiles 0.86724-1.072482), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,478 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212643360: APOGEE DR17 effective temperature 4477.647 +/- 50 K (the catalogue's final uncertainty). log g 2.23 from the mass and radius.

**Colour.** A Planck spectrum at 4,478 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,478 K and log g 2.23 (u1 0.782, u2 0.032): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
