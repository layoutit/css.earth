# EPIC 220217079

## Sources

Its oscillations, recorded in K2 campaign 8, give 1.05 solar masses and 8.2 solar radii; APOGEE spectra give 5,000 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2535047997709416192, distance 4,091 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220217079 (K2 campaign 8): PARAM asteroseismic distance (pc) 4090.9375 (16th-84th percentiles 3936.953125-4253.476562), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 2.747 ± 0.020 mas (139.8 standard errors), is not used. Radius 8.154 +/- 0.3769 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220217079 (K2 campaign 8): PARAM radius (solar radii) 8.154024 (16th-84th percentiles 7.791316-8.54518), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.046 +/- 0.1107 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220217079 (K2 campaign 8): PARAM mass (solar masses) 1.046046 (16th-84th percentiles 0.942622-1.163959), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,000 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220217079: APOGEE DR17 effective temperature 4999.8 +/- 50 K (the catalogue's final uncertainty). log g 2.63 from the mass and radius.

**Colour.** A Planck spectrum at 5,000 K, because pARAM fits an extinction A_V = -0.15 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,000 K and log g 2.63 (u1 0.626, u2 0.150): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object.mts](../../../tools/objects/new-object.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
