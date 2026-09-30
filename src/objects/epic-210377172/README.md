# EPIC 210377172

## Sources

Its oscillations, recorded in K2 campaign 4, give 2.75 solar masses and 18.1 solar radii; APOGEE spectra give 4,973 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 40686813607924736, distance 3,462 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210377172 (K2 campaign 4): PARAM asteroseismic distance (pc) 3461.992188 (16th-84th percentiles 3395.351562-3524.84375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.550 ± 0.016 mas (33.5 standard errors), is not used. Radius 18.1099 +/- 0.5159 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210377172 (K2 campaign 4): PARAM radius (solar radii) 18.109862 (16th-84th percentiles 17.504569-18.536446), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.7463 +/- 0.1627 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210377172 (K2 campaign 4): PARAM mass (solar masses) 2.746292 (16th-84th percentiles 2.540531-2.865889), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,973 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 210377172: APOGEE DR17 effective temperature 4972.777 +/- 50 K (the catalogue's final uncertainty). log g 2.36 from the mass and radius.

**Colour.** A Planck spectrum at 4,973 K, because pARAM fits an extinction A_V = 1.00 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,973 K and log g 2.36 (u1 0.631, u2 0.146): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
