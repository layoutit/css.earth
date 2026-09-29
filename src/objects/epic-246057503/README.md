# EPIC 246057503

## Sources

Its oscillations, recorded in K2 campaign 12, give 1.38 solar masses and 17.8 solar radii; APOGEE spectra give 4,522 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 2630536287614463360, distance 3,888 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246057503 (K2 campaign 12): PARAM asteroseismic distance (pc) 3888.398438 (16th-84th percentiles 3721.25-4060.898438), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.291 ± 0.016 mas (17.9 standard errors), is not used. Radius 17.7745 +/- 1.031 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246057503 (K2 campaign 12): PARAM radius (solar radii) 17.774513 (16th-84th percentiles 16.770309-18.83239), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.3818 +/- 0.1783 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246057503 (K2 campaign 12): PARAM mass (solar masses) 1.381788 (16th-84th percentiles 1.213573-1.570245), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,522 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 246057503: APOGEE DR17 effective temperature 4522.2446 +/- 50 K (the catalogue's final uncertainty). log g 2.08 from the mass and radius.

**Colour.** A Planck spectrum at 4,522 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,522 K and log g 2.08 (u1 0.765, u2 0.046): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
