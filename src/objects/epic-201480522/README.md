# EPIC 201480522

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.03 solar masses and 9.6 solar radii; APOGEE spectra give 4,600 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3795990060114700800, distance 3,431 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201480522 (K2 campaign 1): PARAM asteroseismic distance (pc) 3430.898438 (16th-84th percentiles 3303.710938-3530.390625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.293 ± 0.018 mas (16.4 standard errors), is not used. Radius 9.6335 +/- 0.432 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201480522 (K2 campaign 1): PARAM radius (solar radii) 9.633542 (16th-84th percentiles 9.168405-10.032464), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0342 +/- 0.1216 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201480522 (K2 campaign 1): PARAM mass (solar masses) 1.034208 (16th-84th percentiles 0.904505-1.147786), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,600 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201480522: APOGEE DR17 effective temperature 4599.9287 +/- 50 K (the catalogue's final uncertainty). log g 2.49 from the mass and radius.

**Colour.** A Planck spectrum at 4,600 K, because pARAM fits an extinction A_V = 0.16 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfc0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,600 K and log g 2.49 (u1 0.747, u2 0.058): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
