# EPIC 201333713

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.82 solar masses and 7.6 solar radii; APOGEE spectra give 4,979 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3694680818213845376, distance 5,060 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201333713 (K2 campaign 10): PARAM asteroseismic distance (pc) 5060.273438 (16th-84th percentiles 4917.070312-5211.640625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.128 ± 0.028 mas (4.5 standard errors), is not used. Radius 7.6067 +/- 0.275 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201333713 (K2 campaign 10): PARAM radius (solar radii) 7.606666 (16th-84th percentiles 7.351552-7.901622), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8212 +/- 0.073 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201333713 (K2 campaign 10): PARAM mass (solar masses) 0.821204 (16th-84th percentiles 0.754926-0.900919), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,979 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201333713: APOGEE DR17 effective temperature 4978.7040000000015 +/- 50 K (the catalogue's final uncertainty). log g 2.59 from the mass and radius.

**Colour.** A Planck spectrum at 4,979 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,979 K and log g 2.59 (u1 0.632, u2 0.145): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
