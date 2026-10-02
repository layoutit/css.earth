# TIC 220480911

## Sources

Its oscillations, recorded by TESS, give 1.19 solar masses and 13.5 solar radii; APOGEE spectra give 4,526 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4763793732621020032, distance 1,267 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220480911 (observed by TESS): PARAM asteroseismic distance (pc) 1266.884766 (16th-84th percentiles 1243.496094-1290.957031), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.847 ± 0.011 mas (74.2 standard errors), is not used. Radius 13.5369 +/- 0.4039 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220480911 (observed by TESS): PARAM radius (solar radii) 13.536851 (16th-84th percentiles 13.13837-13.946097), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.194 +/- 0.1014 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220480911 (observed by TESS): PARAM mass (solar masses) 1.194011 (16th-84th percentiles 1.096218-1.299017), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,526 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 220480911: APOGEE DR17 effective temperature 4525.7183 +/- 50 K (the catalogue's final uncertainty). log g 2.25 from the mass and radius.

**Color.** A Planck spectrum at 4,526 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,526 K and log g 2.25 (u1 0.767, u2 0.044): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
