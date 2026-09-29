# EPIC 211687296

## Sources

Its oscillations, recorded in K2 campaign 16, give 0.96 solar masses and 10.3 solar radii; APOGEE spectra give 4,660 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 609874674449809024, distance 4,204 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211687296 (K2 campaign 16): PARAM asteroseismic distance (pc) 4203.984375 (16th-84th percentiles 4054.804688-4364.609375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.228 ± 0.020 mas (11.6 standard errors), is not used. Radius 10.3321 +/- 0.4646 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211687296 (K2 campaign 16): PARAM radius (solar radii) 10.33211 (16th-84th percentiles 9.904598-10.833792), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9568 +/- 0.1006 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211687296 (K2 campaign 16): PARAM mass (solar masses) 0.956805 (16th-84th percentiles 0.866944-1.068065), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,660 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 211687296: APOGEE DR17 effective temperature 4659.638 +/- 50 K (the catalogue's final uncertainty). log g 2.39 from the mass and radius.

**Colour.** A Planck spectrum at 4,660 K, because pARAM fits an extinction A_V = 0.04 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe0c2. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,660 K and log g 2.39 (u1 0.726, u2 0.075): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
