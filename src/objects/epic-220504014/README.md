# EPIC 220504014

## Sources

Its oscillations, recorded in K2 campaign 8, give 0.93 solar masses and 8.6 solar radii; APOGEE spectra give 4,852 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2576923821470844032, distance 3,464 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220504014 (K2 campaign 8): PARAM asteroseismic distance (pc) 3463.867188 (16th-84th percentiles 3349.335938-3582.070312), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.302 ± 0.022 mas (13.7 standard errors), is not used. Radius 8.5772 +/- 0.3553 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220504014 (K2 campaign 8): PARAM radius (solar radii) 8.577194 (16th-84th percentiles 8.235936-8.946516), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9331 +/- 0.093 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220504014 (K2 campaign 8): PARAM mass (solar masses) 0.933052 (16th-84th percentiles 0.845961-1.032041), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,852 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 220504014: APOGEE DR17 effective temperature 4852.3706 +/- 50 K (the catalogue's final uncertainty). log g 2.54 from the mass and radius.

**Colour.** A Planck spectrum at 4,852 K, because pARAM fits an extinction A_V = 0.10 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe4ca. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,852 K and log g 2.54 (u1 0.669, u2 0.118): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
