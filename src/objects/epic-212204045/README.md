# EPIC 212204045

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.82 solar masses and 8.5 solar radii; APOGEE spectra give 4,768 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 689736602021659136, distance 2,482 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212204045 (K2 campaign 16): PARAM asteroseismic distance (pc) 2481.914062 (16th-84th percentiles 2444.667969-2523.808594), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.364 ± 0.015 mas (24.2 standard errors), is not used. Radius 8.4982 +/- 0.1919 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212204045 (K2 campaign 16): PARAM radius (solar radii) 8.498155 (16th-84th percentiles 8.339856-8.723675), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8239 +/- 0.0421 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212204045 (K2 campaign 16): PARAM mass (solar masses) 0.823911 (16th-84th percentiles 0.791395-0.87557), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,768 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212204045: APOGEE DR17 effective temperature 4768.1074 +/- 50 K (the catalogue's final uncertainty). log g 2.5 from the mass and radius.

**Colour.** A Planck spectrum at 4,768 K, because pARAM fits an extinction A_V = 0.02 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,768 K and log g 2.5 (u1 0.693, u2 0.101): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
