# EPIC 201188055

## Sources

Its oscillations, recorded in K2 campaign 1, give 1.11 solar masses and 11.0 solar radii; APOGEE spectra give 4,945 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3599776300263718016, distance 4,473 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201188055 (K2 campaign 1): PARAM asteroseismic distance (pc) 4473.320312 (16th-84th percentiles 4300.9375-4652.65625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.248 ± 0.019 mas (13.0 standard errors), is not used. Radius 10.9982 +/- 0.5687 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201188055 (K2 campaign 1): PARAM radius (solar radii) 10.99824 (16th-84th percentiles 10.44343-11.580782), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.109 +/- 0.1499 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201188055 (K2 campaign 1): PARAM mass (solar masses) 1.108993 (16th-84th percentiles 0.968186-1.267966), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,945 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201188055: APOGEE DR17 effective temperature 4945.052 +/- 122 K (the catalogue's final uncertainty). log g 2.4 from the mass and radius.

**Color.** A Planck spectrum at 4,945 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,945 K and log g 2.4 (u1 0.640, u2 0.140): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
