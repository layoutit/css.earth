# EPIC 229001618

## Sources

Its oscillations, recorded in K2 campaign 10, give 0.98 solar masses and 6.4 solar radii; APOGEE spectra give 4,907 K at its surface. This account was drafted from Khan et al. (2023), A&A 677, A21's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3695330457786872064, distance 3,693 pc from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229001618 (K2 campaign 10): PARAM asteroseismic distance (pc) 3692.851562 (16th-84th percentiles 3569.296875-3820.859375), MA09 pipeline with APOGEE DR17; Gaia DR3's parallax, 0.291 ± 0.022 mas (13.1 standard errors), is not used. Radius 6.3739 +/- 0.2669 solar radii from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229001618 (K2 campaign 10): PARAM radius (solar radii) 6.373877 (16th-84th percentiles 6.116263-6.650134), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Mass 0.9783 +/- 0.0949 solar masses from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229001618 (K2 campaign 10): PARAM mass (solar masses) 0.978265 (16th-84th percentiles 0.888857-1.078737), MA09 pipeline with APOGEE DR17 (https://doi.org/10.1051/0004-6361/202346196). Temperature 4,907 K from Khan et al. (2023), A&A 677, A21, k2_apo, EPIC 229001618: APOGEE DR17 effective temperature 4907.014 +/- 50 K (the catalogue's final uncertainty). log g 2.82 from the mass and radius.

**Colour.** A Planck spectrum at 4,907 K, because pARAM fits an extinction A_V = 0.07 mag toward this star (Khan et al. (2023), A&A 677, A21, k2_apo, AV-M), and the colour routes do not remove extinction; APOGEE measured its temperature, through the CIE 1931 2° observer: #ffe5cc. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,907 K and log g 2.82 (u1 0.657, u2 0.127): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
