# EPIC 211828487

## Sources

Its oscillations, recorded in K2 campaign 5, give 1.13 solar masses and 7.1 solar radii; APOGEE spectra give 4,830 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 662139684799502464, distance 2,515 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211828487 (K2 campaign 5): PARAM asteroseismic distance (pc) 2514.882812 (16th-84th percentiles 2445.605469-2587.539062), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.320 ± 0.026 mas (12.5 standard errors), is not used. Radius 7.1429 +/- 0.255 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211828487 (K2 campaign 5): PARAM radius (solar radii) 7.142881 (16th-84th percentiles 6.895863-7.405843), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1272 +/- 0.0971 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211828487 (K2 campaign 5): PARAM mass (solar masses) 1.127205 (16th-84th percentiles 1.035586-1.229708), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,830 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211828487: APOGEE DR17 effective temperature 4829.5737 +/- 50 K (the catalogue's final uncertainty). log g 2.78 from the mass and radius.

**Colour.** A Planck spectrum at 4,830 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe3c9. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,830 K and log g 2.78 (u1 0.679, u2 0.110): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
