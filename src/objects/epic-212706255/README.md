# EPIC 212706255

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.88 solar masses and 9.5 solar radii; APOGEE spectra give 5,040 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3616272926049559168, distance 5,574 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212706255 (K2 campaign 6): PARAM asteroseismic distance (pc) 5574.0625 (16th-84th percentiles 5391.09375-5767.1875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.062 ± 0.027 mas (2.3 standard errors), is not used. Radius 9.5167 +/- 0.4172 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212706255 (K2 campaign 6): PARAM radius (solar radii) 9.516745 (16th-84th percentiles 9.119776-9.954119), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8801 +/- 0.0933 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212706255 (K2 campaign 6): PARAM mass (solar masses) 0.88006 (16th-84th percentiles 0.794068-0.980758), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,040 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212706255: APOGEE DR17 effective temperature 5040.3257 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 5,040 K, because pARAM fits an extinction A_V = -0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d1. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,040 K and log g 2.43 (u1 0.613, u2 0.158): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
