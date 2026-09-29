# EPIC 248744892

## Sources

Its oscillations, recorded in K2 campaign 14, give 0.76 solar masses and 9.8 solar radii; APOGEE spectra give 4,898 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3869508247975104256, distance 4,883 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248744892 (K2 campaign 14): PARAM asteroseismic distance (pc) 4882.851562 (16th-84th percentiles 4797.070312-4998.867188), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.126 ± 0.026 mas (4.8 standard errors), is not used. Radius 9.8005 +/- 0.3369 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248744892 (K2 campaign 14): PARAM radius (solar radii) 9.800514 (16th-84th percentiles 9.552898-10.226631), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7567 +/- 0.0625 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248744892 (K2 campaign 14): PARAM mass (solar masses) 0.756719 (16th-84th percentiles 0.713765-0.838862), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,898 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 248744892: APOGEE DR17 effective temperature 4898.4165 +/- 50 K (the catalogue's final uncertainty). log g 2.33 from the mass and radius.

**Colour.** A Planck spectrum at 4,898 K, because pARAM fits an extinction A_V = 0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,898 K and log g 2.33 (u1 0.653, u2 0.130): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
