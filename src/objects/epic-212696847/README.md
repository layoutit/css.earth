# EPIC 212696847

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.82 solar masses and 9.8 solar radii; APOGEE spectra give 4,981 K at its surface. The introduction is generated from Khan et al. (2023), A&A 677, A21's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3616250141247743232, distance 2,857 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212696847 (K2 campaign 6): PARAM asteroseismic distance (pc) 2857.03125 (16th-84th percentiles 2811.71875-2906.40625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.332 ± 0.014 mas (23.3 standard errors), is not used. Radius 9.8028 +/- 0.2206 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212696847 (K2 campaign 6): PARAM radius (solar radii) 9.802825 (16th-84th percentiles 9.60822-10.049373), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8228 +/- 0.0383 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212696847 (K2 campaign 6): PARAM mass (solar masses) 0.822766 (16th-84th percentiles 0.788298-0.864856), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,981 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212696847: APOGEE DR17 effective temperature 4980.598 +/- 50 K (the catalogue's final uncertainty). log g 2.37 from the mass and radius.

**Colour.** A Planck spectrum at 4,981 K, because pARAM fits an extinction A_V = 0.12 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6cf. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,981 K and log g 2.37 (u1 0.629, u2 0.147): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
