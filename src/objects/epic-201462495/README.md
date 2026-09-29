# EPIC 201462495

## Sources

Its oscillations, recorded in K2 campaign 10, give 1.19 solar masses and 12.5 solar radii; APOGEE spectra give 4,935 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3698805704804325504, distance 10,456 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201462495 (K2 campaign 10): PARAM asteroseismic distance (pc) 10455.46875 (16th-84th percentiles 10050.15625-10870.9375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.066 ± 0.035 mas (1.9 standard errors), is not used. Radius 12.4746 +/- 0.6539 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201462495 (K2 campaign 10): PARAM radius (solar radii) 12.474556 (16th-84th percentiles 11.833935-13.141829), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.1891 +/- 0.145 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201462495 (K2 campaign 10): PARAM mass (solar masses) 1.189059 (16th-84th percentiles 1.052768-1.342802), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,935 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 201462495: APOGEE DR17 effective temperature 4934.835 +/- 50 K (the catalogue's final uncertainty). log g 2.32 from the mass and radius.

**Colour.** A Planck spectrum at 4,935 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,935 K and log g 2.32 (u1 0.642, u2 0.138): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
