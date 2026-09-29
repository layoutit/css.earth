# EPIC 210708483

## Sources

Its oscillations, recorded in K2 campaign 4, give 1.33 solar masses and 8.4 solar radii; APOGEE spectra give 4,956 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 56690441571012736, distance 1,963 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210708483 (K2 campaign 4): PARAM asteroseismic distance (pc) 1963.417969 (16th-84th percentiles 1908.671875-2019.335938), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.551 ± 0.015 mas (35.6 standard errors), is not used. Radius 8.3984 +/- 0.3052 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210708483 (K2 campaign 4): PARAM radius (solar radii) 8.398385 (16th-84th percentiles 8.099188-8.709674), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3318 +/- 0.1158 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210708483 (K2 campaign 4): PARAM mass (solar masses) 1.331764 (16th-84th percentiles 1.221322-1.452966), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,956 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210708483: APOGEE DR17 effective temperature 4955.9287 +/- 50 K (the catalogue's final uncertainty). log g 2.71 from the mass and radius.

**Colour.** A Planck spectrum at 4,956 K, because pARAM fits an extinction A_V = 0.42 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5ce. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,956 K and log g 2.71 (u1 0.640, u2 0.139): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
