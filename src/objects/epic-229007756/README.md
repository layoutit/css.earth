# EPIC 229007756

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.94 solar masses and 18.3 solar radii; APOGEE spectra give 4,409 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3694073715996827776, distance 5,749 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229007756 (K2 campaign 10): PARAM asteroseismic distance (pc) 5748.671875 (16th-84th percentiles 5498.59375-6057.96875), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.174 ± 0.023 mas (7.7 standard errors), is not used. Radius 18.3443 +/- 1.1289 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229007756 (K2 campaign 10): PARAM radius (solar radii) 18.344291 (16th-84th percentiles 17.392368-19.650208), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9361 +/- 0.1278 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229007756 (K2 campaign 10): PARAM mass (solar masses) 0.936142 (16th-84th percentiles 0.832747-1.0883), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,409 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229007756: APOGEE DR17 effective temperature 4409.3690000000015 +/- 50 K (the catalogue's final uncertainty). log g 1.88 from the mass and radius.

**Colour.** A Planck spectrum at 4,409 K, because pARAM fits an extinction A_V = 0.11 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdcb8. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,409 K and log g 1.88 (u1 0.800, u2 0.018): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
