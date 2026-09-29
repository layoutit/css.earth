# EPIC 212352865

## Sources

Its oscillations, recorded in K2 campaign 6, give 0.89 solar masses and 11.7 solar radii; APOGEE spectra give 4,501 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3605283650927579136, distance 3,171 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352865 (K2 campaign 6): PARAM asteroseismic distance (pc) 3170.585938 (16th-84th percentiles 3096.5625-3265.15625), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.263 ± 0.017 mas (15.5 standard errors), is not used. Radius 11.6871 +/- 0.4314 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352865 (K2 campaign 6): PARAM radius (solar radii) 11.687095 (16th-84th percentiles 11.336566-12.199341), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.8904 +/- 0.0761 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352865 (K2 campaign 6): PARAM mass (solar masses) 0.890391 (16th-84th percentiles 0.83081-0.983042), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,501 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 212352865: APOGEE DR17 effective temperature 4500.58 +/- 50 K (the catalogue's final uncertainty). log g 2.25 from the mass and radius.

**Colour.** A Planck spectrum at 4,501 K, because pARAM fits an extinction A_V = 0.24 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffdebc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,501 K and log g 2.25 (u1 0.775, u2 0.038): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
