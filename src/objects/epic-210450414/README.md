# EPIC 210450414

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.92 solar masses and 12.9 solar radii; APOGEE spectra give 4,547 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3311075848531805824, distance 1,178 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210450414 (K2 campaign 4): PARAM asteroseismic distance (pc) 1177.8125 (16th-84th percentiles 1144.912109-1219.199219), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.799 ± 0.015 mas (54.4 standard errors), is not used. Radius 12.9184 +/- 0.5704 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210450414 (K2 campaign 4): PARAM radius (solar radii) 12.918359 (16th-84th percentiles 12.430821-13.571574), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9215 +/- 0.0942 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210450414 (K2 campaign 4): PARAM mass (solar masses) 0.921533 (16th-84th percentiles 0.843782-1.032271), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,547 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210450414: APOGEE DR17 effective temperature 4547.0654 +/- 50 K (the catalogue's final uncertainty). log g 2.18 from the mass and radius.

**Colour.** A Planck spectrum at 4,547 K, because pARAM fits an extinction A_V = 1.65 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebe. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,547 K and log g 2.18 (u1 0.759, u2 0.050): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
