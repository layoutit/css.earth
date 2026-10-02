# EPIC 212510240

## Sources

Its oscillations, recorded in K2 campaign 17, give 0.80 solar masses and 16.0 solar radii; APOGEE spectra give 4,681 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3609593083673337472, distance 5,703 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212510240 (K2 campaign 17): PARAM asteroseismic distance (pc) 5702.8125 (16th-84th percentiles 5566.796875-5890.078125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.106 ± 0.019 mas (5.7 standard errors), is not used. Radius 15.9968 +/- 0.7256 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212510240 (K2 campaign 17): PARAM radius (solar radii) 15.996818 (16th-84th percentiles 15.439503-16.89064), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7997 +/- 0.0804 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212510240 (K2 campaign 17): PARAM mass (solar masses) 0.799659 (16th-84th percentiles 0.741646-0.902441), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,681 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212510240: APOGEE DR17 effective temperature 4681.482 +/- 50 K (the catalogue's final uncertainty). log g 1.93 from the mass and radius.

**Color.** A Planck spectrum at 4,681 K, because pARAM fits an extinction A_V = 0.09 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,681 K and log g 1.93 (u1 0.714, u2 0.085): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
