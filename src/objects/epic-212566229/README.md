# EPIC 212566229

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.80 solar masses and 10.8 solar radii; APOGEE spectra give 4,990 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3613501022876533632, distance 4,003 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212566229 (K2 campaign 17): PARAM asteroseismic distance (pc) 4002.539062 (16th-84th percentiles 3940.820312-4068.320312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.258 ± 0.015 mas (17.6 standard errors), is not used. Radius 10.7587 +/- 0.2544 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212566229 (K2 campaign 17): PARAM radius (solar radii) 10.75871 (16th-84th percentiles 10.535361-11.044117), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7954 +/- 0.043 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212566229 (K2 campaign 17): PARAM mass (solar masses) 0.79536 (16th-84th percentiles 0.760859-0.846838), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,990 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212566229: APOGEE DR17 effective temperature 4989.8945 +/- 50 K (the catalogue's final uncertainty). log g 2.28 from the mass and radius.

**Colour.** A Planck spectrum at 4,990 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,990 K and log g 2.28 (u1 0.625, u2 0.150): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
