# T Mon

## Sources

Its mean radius, 114 solar radii, comes from comparing how fast its surface moves with how its size changes, 1,126 parsecs away. It is also HD 44990, HR 2310, HIP 30541. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 3324535073449061504, distance 1,126 pc from Groenewegen (2013), A&A 550, A70, table10, T Mon: Baade-Wesselink distance (pc) 1125.9 +/- 33 (Monte-Carlo); Gaia DR3's parallax, 0.714 ± 0.052 mas (13.8 standard errors), is not used. Radius 114 +/- 3.4 solar radii from Groenewegen (2013), A&A 550, A70, table10, T Mon: Baade-Wesselink mean radius (solar radii) 114 +/- 3.4 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 4,875 K from Groenewegen (2020), A&A 635, A33, VizieR J/A+A/635/A33/table1, recno 175, Name='T Mon', columns Teff, e_Teff (K): Teff 4875 +/- 189 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0.49 from 2024A&A...690A.246T ("Cepheid Metallicity in the Leavitt Law (C-MetaLL) survey VI. Radial abundance gradients of 29 chemical species in the Milky Way disc.").

**Colour.** A Planck spectrum at 4,875 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.181 +/- 0.011 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe4cb. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 4,875 K and log g 0.49 (u1 0.665, u2 0.101): a model, because no fit of this star's limb is used. Gravity: log g 0.49 from 2024A&A...690A.246T; the 21 published values span log g 0.49 to 1.46, across which the limb law changes by at most 1.4% of the centre brightness.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
