# EPIC 201328572

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.81 solar masses and 17.6 solar radii; APOGEE spectra give 4,766 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3601462156531028480, distance 3,286 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201328572 (K2 campaign 10): PARAM asteroseismic distance (pc) 3285.546875 (16th-84th percentiles 3161.875-3468.828125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.353 ± 0.021 mas (16.5 standard errors), is not used. Radius 17.6368 +/- 1.0444 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201328572 (K2 campaign 10): PARAM radius (solar radii) 17.636771 (16th-84th percentiles 16.792691-18.881511), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8105 +/- 0.1031 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201328572 (K2 campaign 10): PARAM mass (solar masses) 0.810539 (16th-84th percentiles 0.729874-0.936137), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,766 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201328572: APOGEE DR17 effective temperature 4766.0557 +/- 50 K (the catalogue's final uncertainty). log g 1.85 from the mass and radius.

**Colour.** A Planck spectrum at 4,766 K, because pARAM fits an extinction A_V = -0.03 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,766 K and log g 1.85 (u1 0.687, u2 0.104): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
