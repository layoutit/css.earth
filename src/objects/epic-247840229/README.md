# EPIC 247840229

## Sources

Its oscillations, recorded in K2 campaign 13, give 1.34 solar masses and 10.3 solar radii; APOGEE spectra give 4,658 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3419560945696607104, distance 1,004 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247840229 (K2 campaign 13): PARAM asteroseismic distance (pc) 1004.150391 (16th-84th percentiles 984.658203-1023.535156), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.921 ± 0.019 mas (47.7 standard errors), is not used. Radius 10.2655 +/- 0.2939 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247840229 (K2 campaign 13): PARAM radius (solar radii) 10.26555 (16th-84th percentiles 9.982591-10.570428), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3412 +/- 0.0827 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247840229 (K2 campaign 13): PARAM mass (solar masses) 1.341196 (16th-84th percentiles 1.261626-1.42708), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,658 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 247840229: APOGEE DR17 effective temperature 4657.9395 +/- 50 K (the catalogue's final uncertainty). log g 2.54 from the mass and radius.

**Colour.** A Planck spectrum at 4,658 K, because pARAM fits an extinction A_V = 1.30 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,658 K and log g 2.54 (u1 0.729, u2 0.072): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
