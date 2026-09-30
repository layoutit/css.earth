# TIC 279250092

## Sources

Its oscillations, recorded by TESS, give 1.97 solar masses and 22.1 solar radii; APOGEE spectra give 4,485 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5483803321433809152, distance 1,262 pc from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279250092 (observed by TESS): PARAM asteroseismic distance (pc) 1261.865234 (16th-84th percentiles 1236.40625-1288.144531), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.793 ± 0.010 mas (77.0 standard errors), is not used. Radius 22.0679 +/- 0.7137 solar radii from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279250092 (observed by TESS): PARAM radius (solar radii) 22.067946 (16th-84th percentiles 21.391768-22.819114), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 1.9678 +/- 0.1676 solar masses from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279250092 (observed by TESS): PARAM mass (solar masses) 1.967754 (16th-84th percentiles 1.810193-2.145422), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,485 K from Khan et al. (2023), A&A 677, A21, tess_apo, TIC 279250092: APOGEE DR17 effective temperature 4485.4014 +/- 50 K (the catalogue's final uncertainty). log g 2.04 from the mass and radius.

**Colour.** A Planck spectrum at 4,485 K, because pARAM fits an extinction A_V = 0.44 mag toward this star (Khan et al. (2023), A&A 677, A21, tess_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffddbb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,485 K and log g 2.04 (u1 0.776, u2 0.037): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
