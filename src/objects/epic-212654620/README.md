# EPIC 212654620

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.87 solar masses and 7.0 solar radii; APOGEE spectra give 5,023 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3615524192990866560, distance 3,182 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212654620 (K2 campaign 6): PARAM asteroseismic distance (pc) 3181.757812 (16th-84th percentiles 3082.929688-3284.882812), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.279 ± 0.018 mas (15.5 standard errors), is not used. Radius 6.9625 +/- 0.2852 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212654620 (K2 campaign 6): PARAM radius (solar radii) 6.96249 (16th-84th percentiles 6.690399-7.260749), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8748 +/- 0.0852 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212654620 (K2 campaign 6): PARAM mass (solar masses) 0.874783 (16th-84th percentiles 0.795871-0.966316), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 5,023 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212654620: APOGEE DR17 effective temperature 5023.237 +/- 50 K (the catalogue's final uncertainty). log g 2.69 from the mass and radius.

**Colour.** A Planck spectrum at 5,023 K, because pARAM fits an extinction A_V = 0.06 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,023 K and log g 2.69 (u1 0.621, u2 0.153): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
