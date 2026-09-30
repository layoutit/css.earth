# EPIC 220696594

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.98 solar masses and 11.6 solar radii; APOGEE spectra give 4,816 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2582720141830178176, distance 3,292 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220696594 (K2 campaign 8): PARAM asteroseismic distance (pc) 3291.640625 (16th-84th percentiles 3215.78125-3384.6875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.252 ± 0.016 mas (15.3 standard errors), is not used. Radius 11.5571 +/- 0.4844 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220696594 (K2 campaign 8): PARAM radius (solar radii) 11.557114 (16th-84th percentiles 11.142326-12.111225), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.977 +/- 0.0992 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220696594 (K2 campaign 8): PARAM mass (solar masses) 0.976951 (16th-84th percentiles 0.897803-1.096274), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,816 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220696594: APOGEE DR17 effective temperature 4816.4053 +/- 50 K (the catalogue's final uncertainty). log g 2.3 from the mass and radius.

**Colour.** A Planck spectrum at 4,816 K, because pARAM fits an extinction A_V = 0.23 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,816 K and log g 2.3 (u1 0.677, u2 0.113): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
