# EPIC 212344169

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.85 solar masses and 12.2 solar radii; APOGEE spectra give 4,567 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3607431542596659072, distance 2,019 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212344169 (K2 campaign 6): PARAM asteroseismic distance (pc) 2018.535156 (16th-84th percentiles 1973.417969-2077.96875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.479 ± 0.015 mas (31.0 standard errors), is not used. Radius 12.1982 +/- 0.42 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212344169 (K2 campaign 6): PARAM radius (solar radii) 12.198156 (16th-84th percentiles 11.864964-12.704868), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8528 +/- 0.0673 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212344169 (K2 campaign 6): PARAM mass (solar masses) 0.852829 (16th-84th percentiles 0.801771-0.936357), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,567 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212344169: APOGEE DR17 effective temperature 4566.951 +/- 50 K (the catalogue's final uncertainty). log g 2.2 from the mass and radius.

**Colour.** A Planck spectrum at 4,567 K, because pARAM fits an extinction A_V = 0.19 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdfbf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,567 K and log g 2.2 (u1 0.753, u2 0.055): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
