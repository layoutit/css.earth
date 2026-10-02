# HV 12815

## Sources

Its mean radius, 105.2 solar radii, comes from comparing how fast its surface moves with how its size changes, 39,034 parsecs away. The introduction is generated from Groenewegen (2013), A&A 550, A70's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4660363361045224192, distance 39,034 pc from Groenewegen (2013), A&A 550, A70, table10, HV 12815: Baade-Wesselink distance (pc) 39034.2 +/- 3812 (Monte-Carlo); Gaia DR3's parallax, -0.017 ± 0.016 mas (-1.1 standard errors), is not used. Radius 105.2 +/- 11 solar radii from Groenewegen (2013), A&A 550, A70, table10, HV 12815: Baade-Wesselink mean radius (solar radii) 105.2 +/- 11 (Monte-Carlo) (https://arxiv.org/abs/1212.5478). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,125 K from Groenewegen & Lub (2023), A&A 676, A136, VizieR J/A+A/676/A136/table1, Name=LMC4066, columns Teffp, e_Teffp: Teff 5125 +/- 88 K from a fit to the spectral energy distribution at mean light (not spectroscopic). No surface gravity of this star is published.

**Color.** A Planck spectrum at 5,125 K, because interstellar dust reddens every spectrum of this star, E(B-V) = 0.07 +/- 0.005 (Groenewegen (2013), A&A 550, A70, table10), and its light changes through each pulsation, through the CIE 1931 2° observer: #ffe8d4. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,125 K and log g 0.85 (u1 0.591, u2 0.156): a model, because no fit of this star's limb is used. Gravity: no gravity of this star is published (none in SIMBAD); Luck (2018), AJ 156, 171, table 3 (the spectroscopic gravities of its Cepheid spectra) gives the class's range, log g -1.33 to 2.86. Across log g 0 to 2.85, the part the grid covers, the limb laws differ by at most 1.9% of the centre brightness from the one drawn, at log g 0.85, the gravity closest to all of them; log g 0.85 is a display choice, not a measurement.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and a display gravity inside its class's published range (see Limb), not a measurement of this star.
- **Not shown.** The star pulsates; it is drawn at its mean radius.
- **Not shown.** No dynamical mass is measured for this Cepheid; its mass is left unmeasured.
- **Not shown.** No surface gravity averaged over the pulsation is published, only single-phase values, so no limb darkening is drawn.
- **Not shown.** Its distance is the Baade-Wesselink one its radius was measured at, so the Magellanic Cepheids spread a few kiloparsecs in depth.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
