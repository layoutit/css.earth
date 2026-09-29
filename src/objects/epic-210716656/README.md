# EPIC 210716656

## Sources

Its oscillations, recorded in K2 campaign 4, give 0.89 solar masses and 10.5 solar radii; APOGEE spectra give 4,743 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 56712814058061696, distance 2,523 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210716656 (K2 campaign 4): PARAM asteroseismic distance (pc) 2523.417969 (16th-84th percentiles 2477.65625-2574.335938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.425 ± 0.018 mas (23.3 standard errors), is not used. Radius 10.4891 +/- 0.2754 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210716656 (K2 campaign 4): PARAM radius (solar radii) 10.489092 (16th-84th percentiles 10.243963-10.794858), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8857 +/- 0.0564 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210716656 (K2 campaign 4): PARAM mass (solar masses) 0.88565 (16th-84th percentiles 0.838554-0.9514), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,743 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210716656: APOGEE DR17 effective temperature 4743.3926 +/- 50 K (the catalogue's final uncertainty). log g 2.34 from the mass and radius.

**Colour.** A Planck spectrum at 4,743 K, because pARAM fits an extinction A_V = 0.50 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c6. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,743 K and log g 2.34 (u1 0.699, u2 0.096): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
