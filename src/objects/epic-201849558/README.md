# EPIC 201849558

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.27 solar masses and 10.1 solar radii; APOGEE spectra give 5,204 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3910274088979776768, distance 4,438 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201849558 (K2 campaign 1): PARAM asteroseismic distance (pc) 4437.734375 (16th-84th percentiles 4248.007812-4563.4375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.248 ± 0.019 mas (13.2 standard errors), is not used. Radius 10.0807 +/- 0.7294 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201849558 (K2 campaign 1): PARAM radius (solar radii) 10.080656 (16th-84th percentiles 9.039059-10.497837), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.2657 +/- 0.2015 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201849558 (K2 campaign 1): PARAM mass (solar masses) 1.265705 (16th-84th percentiles 1.000986-1.404051), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,204 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201849558: APOGEE DR17 effective temperature 5203.838 +/- 271 K (the catalogue's final uncertainty). log g 2.53 from the mass and radius.

**Color.** A Planck spectrum at 5,204 K, because pARAM fits an extinction A_V = 0.48 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe9d7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,204 K and log g 2.53 (u1 0.570, u2 0.188): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
