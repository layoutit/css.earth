# EPIC 211691179

## Sources

Its oscillations, recorded in K2 campaign 16, give 2.77 solar masses and 18.9 solar radii; APOGEE spectra give 5,044 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 609902093520941952, distance 10,204 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211691179 (K2 campaign 16): PARAM asteroseismic distance (pc) 10204.375 (16th-84th percentiles 9992.03125-10402.1875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.118 ± 0.020 mas (5.9 standard errors), is not used. Radius 18.8509 +/- 0.4437 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211691179 (K2 campaign 16): PARAM radius (solar radii) 18.85089 (16th-84th percentiles 18.36524-19.252674), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.7707 +/- 0.135 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211691179 (K2 campaign 16): PARAM mass (solar masses) 2.770662 (16th-84th percentiles 2.634841-2.904853), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,044 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211691179: APOGEE DR17 effective temperature 5043.643 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Colour.** A Planck spectrum at 5,044 K, because pARAM fits an extinction A_V = 0.01 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,044 K and log g 2.33 (u1 0.611, u2 0.160): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
