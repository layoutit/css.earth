# TIC 38600923

## Sources

Its oscillations, recorded by TESS, give 0.80 solar masses and 21.6 solar radii; APOGEE spectra give 4,484 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4675090254093369600, distance 1,153 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38600923 (observed by TESS): PARAM asteroseismic distance (pc) 1153.339844 (16th-84th percentiles 1142.519531-1164.638672), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.824 ± 0.011 mas (72.5 standard errors), is not used. Radius 21.5884 +/- 0.3387 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38600923 (observed by TESS): PARAM radius (solar radii) 21.58841 (16th-84th percentiles 21.330765-22.00821), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.7989 +/- 0.0405 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38600923 (observed by TESS): PARAM mass (solar masses) 0.798929 (16th-84th percentiles 0.770156-0.851242), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,484 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 38600923: APOGEE DR17 effective temperature 4484.17 +/- 50 K (the catalogue's final uncertainty). log g 1.67 from the mass and radius.

**Colour.** A Planck spectrum at 4,484 K, because pARAM fits an extinction A_V = 0.25 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,484 K and log g 1.67 (u1 0.773, u2 0.040): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
