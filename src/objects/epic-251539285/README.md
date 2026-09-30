# EPIC 251539285

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.00 solar masses and 7.9 solar radii; APOGEE spectra give 5,255 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3637208933112436224, distance 5,163 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251539285 (K2 campaign 17): PARAM asteroseismic distance (pc) 5163.28125 (16th-84th percentiles 5003.4375-5327.34375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.200 ± 0.028 mas (7.1 standard errors), is not used. Radius 7.8822 +/- 0.3299 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251539285 (K2 campaign 17): PARAM radius (solar radii) 7.882231 (16th-84th percentiles 7.558382-8.218108), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.996 +/- 0.1006 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251539285 (K2 campaign 17): PARAM mass (solar masses) 0.995951 (16th-84th percentiles 0.89966-1.100865), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,255 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 251539285: APOGEE DR17 effective temperature 5255.2056 +/- 59 K (the catalogue's final uncertainty). log g 2.64 from the mass and radius.

**Colour.** A Planck spectrum at 5,255 K, because pARAM fits an extinction A_V = 0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffead9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,255 K and log g 2.64 (u1 0.557, u2 0.197): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
