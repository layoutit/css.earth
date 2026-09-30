# TIC 150190232

## Sources

Its oscillations, recorded by TESS, give 1.08 solar masses and 27.5 solar radii; APOGEE spectra give 4,310 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5481058906050580608, distance 1,561 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 150190232 (observed by TESS): PARAM asteroseismic distance (pc) 1560.507812 (16th-84th percentiles 1520.410156-1601.035156), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.710 ± 0.013 mas (54.6 standard errors), is not used. Radius 27.5289 +/- 1.1899 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 150190232 (observed by TESS): PARAM radius (solar radii) 27.528905 (16th-84th percentiles 26.34695-28.726744), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.0838 +/- 0.1321 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 150190232 (observed by TESS): PARAM mass (solar masses) 1.083814 (16th-84th percentiles 0.957809-1.22207), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,310 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 150190232: APOGEE DR17 effective temperature 4309.8438 +/- 50 K (the catalogue's final uncertainty). log g 1.59 from the mass and radius.

**Colour.** A Planck spectrum at 4,310 K, because pARAM fits an extinction A_V = 0.34 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdab4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,310 K and log g 1.59 (u1 0.832, u2 -0.008): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
