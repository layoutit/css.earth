# TIC 149902216

## Sources

Its oscillations, recorded by TESS, give 1.17 solar masses and 10.8 solar radii; APOGEE spectra give 4,769 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4758740342820425088, distance 1,065 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149902216 (observed by TESS): PARAM asteroseismic distance (pc) 1064.6875 (16th-84th percentiles 1042.675781-1079.667969), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.952 ± 0.010 mas (98.9 standard errors), is not used. Radius 10.7518 +/- 0.1739 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149902216 (observed by TESS): PARAM radius (solar radii) 10.751849 (16th-84th percentiles 10.583193-10.931019), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.171 +/- 0.0553 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149902216 (observed by TESS): PARAM mass (solar masses) 1.171046 (16th-84th percentiles 1.115688-1.226193), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,769 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 149902216: APOGEE DR17 effective temperature 4769.084 +/- 50 K (the catalogue's final uncertainty). log g 2.44 from the mass and radius.

**Colour.** A Planck spectrum at 4,769 K, because pARAM fits an extinction A_V = 0.21 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe2c7. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,769 K and log g 2.44 (u1 0.692, u2 0.101): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
