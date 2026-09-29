# EPIC 211812508

## Sources

Its oscillations, recorded in K2 campaign 16, give 1.03 solar masses and 9.6 solar radii; APOGEE spectra give 5,357 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 611818782806219264, distance 5,103 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211812508 (K2 campaign 16): PARAM asteroseismic distance (pc) 5102.96875 (16th-84th percentiles 4967.070312-5234.296875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.182 ± 0.021 mas (8.7 standard errors), is not used. Radius 9.5628 +/- 0.383 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211812508 (K2 campaign 16): PARAM radius (solar radii) 9.562803 (16th-84th percentiles 9.174965-9.94106), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0279 +/- 0.11 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211812508 (K2 campaign 16): PARAM mass (solar masses) 1.027868 (16th-84th percentiles 0.931234-1.151237), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,357 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211812508: APOGEE DR17 effective temperature 5357.3315 +/- 58 K (the catalogue's final uncertainty). log g 2.49 from the mass and radius.

**Colour.** A Planck spectrum at 5,357 K, because pARAM fits an extinction A_V = 0.32 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffebdc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,357 K and log g 2.49 (u1 0.531, u2 0.213): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
