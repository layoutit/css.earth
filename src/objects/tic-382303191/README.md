# TIC 382303191

## Sources

Its oscillations, recorded by TESS, give 0.92 solar masses and 11.7 solar radii; APOGEE spectra give 4,669 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4766837627483079424, distance 1,075 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382303191 (observed by TESS): PARAM asteroseismic distance (pc) 1075.117188 (16th-84th percentiles 1060.078125-1091.044922), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.853 ± 0.009 mas (97.3 standard errors), is not used. Radius 11.7221 +/- 0.2765 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382303191 (observed by TESS): PARAM radius (solar radii) 11.722092 (16th-84th percentiles 11.474613-12.027567), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.922 +/- 0.0647 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382303191 (observed by TESS): PARAM mass (solar masses) 0.922028 (16th-84th percentiles 0.864965-0.994312), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,669 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 382303191: APOGEE DR17 effective temperature 4669.3984 +/- 50 K (the catalogue's final uncertainty). log g 2.26 from the mass and radius.

**Color.** A Planck spectrum at 4,669 K, because pARAM fits an extinction A_V = 0.17 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the color routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe1c3. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,669 K and log g 2.26 (u1 0.722, u2 0.079): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
