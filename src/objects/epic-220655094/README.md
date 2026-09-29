# EPIC 220655094

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.87 solar masses and 8.1 solar radii; APOGEE spectra give 4,664 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2582209212520701952, distance 2,967 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220655094 (K2 campaign 8): PARAM asteroseismic distance (pc) 2967.226562 (16th-84th percentiles 2909.804688-3033.203125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.299 ± 0.022 mas (13.3 standard errors), is not used. Radius 8.1213 +/- 0.2277 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220655094 (K2 campaign 8): PARAM radius (solar radii) 8.121332 (16th-84th percentiles 7.924707-8.380156), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8693 +/- 0.0569 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220655094 (K2 campaign 8): PARAM mass (solar masses) 0.869324 (16th-84th percentiles 0.822181-0.935999), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,664 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220655094: APOGEE DR17 effective temperature 4663.782 +/- 50 K (the catalogue's final uncertainty). log g 2.56 from the mass and radius.

**Colour.** A Planck spectrum at 4,664 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,664 K and log g 2.56 (u1 0.727, u2 0.074): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
