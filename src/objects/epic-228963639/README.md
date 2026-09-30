# EPIC 228963639

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.00 solar masses and 10.9 solar radii; APOGEE spectra give 5,137 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3693955793374760064, distance 3,166 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228963639 (K2 campaign 10): PARAM asteroseismic distance (pc) 3165.664062 (16th-84th percentiles 3092.382812-3282.734375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.390 ± 0.015 mas (26.2 standard errors), is not used. Radius 10.8802 +/- 0.4701 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228963639 (K2 campaign 10): PARAM radius (solar radii) 10.880244 (16th-84th percentiles 10.532276-11.472383), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0014 +/- 0.1006 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228963639 (K2 campaign 10): PARAM mass (solar masses) 1.001401 (16th-84th percentiles 0.921303-1.12243), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,137 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 228963639: APOGEE DR17 effective temperature 5137.1123 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 5,137 K, because pARAM fits an extinction A_V = -0.05 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe8d5. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,137 K and log g 2.37 (u1 0.587, u2 0.176): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
