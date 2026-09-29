# EPIC 201256925

## Sources

Its oscillations, recorded in K2 campaign 1, give 0.99 solar masses and 8.3 solar radii; APOGEE spectra give 4,704 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3787465817047274752, distance 2,051 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201256925 (K2 campaign 1): PARAM asteroseismic distance (pc) 2050.664062 (16th-84th percentiles 1999.53125-2109.609375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.455 ± 0.019 mas (23.9 standard errors), is not used. Radius 8.3061 +/- 0.3081 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201256925 (K2 campaign 1): PARAM radius (solar radii) 8.306113 (16th-84th percentiles 8.042899-8.659018), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9925 +/- 0.097 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201256925 (K2 campaign 1): PARAM mass (solar masses) 0.992494 (16th-84th percentiles 0.915178-1.10919), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,704 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201256925: APOGEE DR17 effective temperature 4704.0063 +/- 50 K (the catalogue's final uncertainty). log g 2.6 from the mass and radius.

**Colour.** A Planck spectrum at 4,704 K, because pARAM fits an extinction A_V = 0.20 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,704 K and log g 2.6 (u1 0.715, u2 0.083): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
