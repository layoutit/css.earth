# TZ Mon

## Sources

Its mean radius, 59.2 solar radii, comes from comparing how fast its surface moves with how its size changes, 4,326 parsecs away. It is also HIP 33520. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3112475495616980992, distance 4,326 pc from Groenewegen (2013), A&A 550, A70, table10, TZ Mon: Baade-Wesselink distance (pc) 4325.6 +/- 385.2 (Monte-Carlo); Gaia DR3's parallax, 0.266 ± 0.015 mas (17.5 standard errors), is not used. Radius 59.2 +/- 5.3 solar radii from Groenewegen (2013), A&A 550, A70, table10, TZ Mon: Baade-Wesselink mean radius (solar radii) 59.2 +/- 5.3 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,375 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 187, Name='TZ Mon', columns Teff, e_Teff (K): Teff 5375 +/- 204 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 1.2 from 2023A&A...678A.195D ("Oxygen, sulfur, and iron radial abundance gradients of classical Cepheids across the Galactic thin disk.").

**Color.** A Planck spectrum at 5,375 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.431 +/- 0.029 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffecdd. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,375 K and log g 1.2 (u1 0.531, u2 0.198): a model, because no fit of this star's limb is used. Gravity: log g 1.2 from 2023A&A...678A.195D; the 7 published values span log g 1.2 to 3.158, across which the limb law changes by at most 1.7% of the centre brightness.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
