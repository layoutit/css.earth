# HV 900

## Sources

Its mean radius, 165 solar radii, comes from comparing how fast its surface moves with how its size changes, 45,392 parsecs away. It is also HD 269075. This account was drafted from Groenewegen (2013), A&A 550, A70's values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4655176243131693696, distance 45,392 pc from Groenewegen (2013), A&A 550, A70, table10, HV 900: Baade-Wesselink distance (pc) 45391.7 +/- 1358.3 (Monte-Carlo); Gaia DR3's parallax, 0.050 ± 0.018 mas (2.8 standard errors), is not used. Radius 165 +/- 4.7 solar radii from Groenewegen (2013), A&A 550, A70, table10, HV 900: Baade-Wesselink mean radius (solar radii) 165 +/- 4.7 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,000 K from Groenewegen & Lub (2023), A&A 676, A136, VizieR J/A+A/676/A136/table1, Name=LMC0966, columns Teffp, e_Teffp: Teff 5000 +/- 204 K from a fit to the spectral energy distribution at mean light (not spectroscopic). log g 0 from 2022A&A...658A..29R ("The iron and oxygen content of LMC Classical Cepheids and its implications for the extragalactic distance scale and Hubble constant. Equivalent width analysis with Kurucz stellar atmosphere models.").

**Colour.** A Planck spectrum at 5,000 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.058 +/- 0.005 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe6d0. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,000 K and log g 0 (u1 0.640, u2 0.101): a model, because no fit of this star's limb is used. Gravity: log g 0 from 2022A&A...658A..29R; the 2 published values span log g 0 to 1.19, across which the limb law changes by at most 2.4% of the centre brightness.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the lens's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Not shown.** No surface gravity averaged over the pulsation is published, only single-phase values, so no limb darkening is drawn.
- **Not shown.** Its distance is the Baade-Wesselink one its radius was measured at, so the Magellanic Cepheids spread a few kiloparsecs in depth.
- **Drafted text.** The card and introduction were written by the generator from the cited values, not by a person.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · Provenance (`prepared/provenance.json`) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
