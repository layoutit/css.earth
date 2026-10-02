# TIC 278777940

## Sources

Its oscillations, recorded by TESS, give 0.87 solar masses and 13.9 solar radii; APOGEE spectra give 4,452 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5483261880676003072, distance 1,172 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 278777940 (observed by TESS): PARAM asteroseismic distance (pc) 1171.855469 (16th-84th percentiles 1157.773438-1188.583984), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.785 ± 0.011 mas (71.4 standard errors), is not used. Radius 13.9207 +/- 0.3113 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 278777940 (observed by TESS): PARAM radius (solar radii) 13.920725 (16th-84th percentiles 13.669374-14.291986), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8716 +/- 0.0564 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 278777940 (observed by TESS): PARAM mass (solar masses) 0.871601 (16th-84th percentiles 0.826775-0.939557), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,452 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 278777940: APOGEE DR17 effective temperature 4452.486 +/- 50 K (the catalogue's final uncertainty). log g 2.09 from the mass and radius.

**Color.** A Planck spectrum at 4,452 K, because pARAM fits an extinction A_V = 0.43 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddba. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,452 K and log g 2.09 (u1 0.788, u2 0.027): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
