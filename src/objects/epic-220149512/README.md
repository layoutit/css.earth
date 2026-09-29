# EPIC 220149512

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.86 solar masses and 9.2 solar radii; APOGEE spectra give 5,148 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2532084882592108416, distance 1,818 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220149512 (K2 campaign 8): PARAM asteroseismic distance (pc) 1817.734375 (16th-84th percentiles 1786.074219-1850.566406), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.550 ± 0.017 mas (31.6 standard errors), is not used. Radius 9.2478 +/- 0.2666 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220149512 (K2 campaign 8): PARAM radius (solar radii) 9.247751 (16th-84th percentiles 8.976041-9.509151), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8554 +/- 0.0666 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220149512 (K2 campaign 8): PARAM mass (solar masses) 0.855355 (16th-84th percentiles 0.77381-0.906989), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,148 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220149512: APOGEE DR17 effective temperature 5148.0146 +/- 50 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 5,148 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,148 K and log g 2.44 (u1 0.584, u2 0.178): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
