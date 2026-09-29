# EPIC 211630893

## Sources

Its oscillations, recorded in K2 campaign 5, give 2.16 solar masses and 15.7 solar radii; APOGEE spectra give 4,923 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 657567606212144256, distance 6,211 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211630893 (K2 campaign 5): PARAM asteroseismic distance (pc) 6210.625 (16th-84th percentiles 5932.578125-6401.09375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.260 ± 0.017 mas (15.4 standard errors), is not used. Radius 15.7288 +/- 0.9644 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211630893 (K2 campaign 5): PARAM radius (solar radii) 15.728808 (16th-84th percentiles 14.571075-16.49997), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 2.1562 +/- 0.2882 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211630893 (K2 campaign 5): PARAM mass (solar masses) 2.156196 (16th-84th percentiles 1.820778-2.397257), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,923 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211630893: APOGEE DR17 effective temperature 4923.1484 +/- 50 K (the catalogue's final uncertainty). log g 2.38 from the mass and radius.

**Colour.** A Planck spectrum at 4,923 K, because pARAM fits an extinction A_V = 0.13 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,923 K and log g 2.38 (u1 0.646, u2 0.135): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
