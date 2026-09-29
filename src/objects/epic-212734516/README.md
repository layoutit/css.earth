# EPIC 212734516

## Sources

Its oscillations, recorded in K2 campaign 17, give 1.11 solar masses and 5.8 solar radii; APOGEE spectra give 5,001 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3628384012269752960, distance 3,055 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212734516 (K2 campaign 17): PARAM asteroseismic distance (pc) 3054.804688 (16th-84th percentiles 2971.796875-3141.328125), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.307 ± 0.026 mas (12.0 standard errors), is not used. Radius 5.7556 +/- 0.2043 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212734516 (K2 campaign 17): PARAM radius (solar radii) 5.755608 (16th-84th percentiles 5.557792-5.966349), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1078 +/- 0.0931 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212734516 (K2 campaign 17): PARAM mass (solar masses) 1.107835 (16th-84th percentiles 1.019814-1.206113), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,001 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212734516: APOGEE DR17 effective temperature 5000.5073 +/- 50 K (the catalogue's final uncertainty). log g 2.96 from the mass and radius.

**Colour.** A Planck spectrum at 5,001 K, because pARAM fits an extinction A_V = 0.14 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,001 K and log g 2.96 (u1 0.630, u2 0.146): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
