# EPIC 220488681

## Sources

Its oscillations, recorded in K2 campaign 8, give 1.15 solar masses and 10.8 solar radii; APOGEE spectra give 5,086 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2556269117585964160, distance 4,590 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220488681 (K2 campaign 8): PARAM asteroseismic distance (pc) 4589.84375 (16th-84th percentiles 4359.023438-4754.804688), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.177 ± 0.019 mas (9.3 standard errors), is not used. Radius 10.759 +/- 0.6487 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220488681 (K2 campaign 8): PARAM radius (solar radii) 10.759017 (16th-84th percentiles 10.159867-11.457249), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.145 +/- 0.1551 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220488681 (K2 campaign 8): PARAM mass (solar masses) 1.144955 (16th-84th percentiles 1.011456-1.321627), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,086 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220488681: APOGEE DR17 effective temperature 5086.2383 +/- 50 K (the catalogue's final uncertainty). log g 2.43 from the mass and radius.

**Colour.** A Planck spectrum at 5,086 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe7d3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,086 K and log g 2.43 (u1 0.601, u2 0.167): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
