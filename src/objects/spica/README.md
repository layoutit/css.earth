# Spica

## Sources

Their orbit weighs the larger at 11.43 solar masses: it is 7.47 solar radii, 25,300 K at its surface, and pulsates. It is also HD 116658, HR 5056, HIP 65474. The introduction is generated from Tkachenko et al. (2016), MNRAS 458, 1964's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 65474 (SIMBAD HD 116658); placed by that row, not by a Gaia source, distance 76.57 pc from van Leeuwen (2007), A&A 474, 653, HIP 65474: Hipparcos parallax 13.06 +/- 0.70 mas, inverted. Radius 7.47 +/- 0.54 solar radii from Tkachenko et al. (2016), MNRAS 458, 1964, Table 7: primary radius 7.47 +/- 0.54 solar radii from the combined light- and radial-velocity-curve solution (https://doi.org/10.1093/mnras/stw255). Mass 11.43 +/- 1.15 solar masses from Tkachenko et al. (2016), MNRAS 458, 1964, Table 7: dynamical mass of the primary 11.43 +/- 1.15 solar masses (https://doi.org/10.1093/mnras/stw255). Temperature 25,300 K from Tkachenko et al. (2016), MNRAS 458, 1964, Tables 4 and 7: primary Teff 25,300 +/- 500 K from the disentangled spectrum. log g 3.75 from the mass and radius.

**Color.** A Planck spectrum at 25,300 K, because every spectrum of Spica is the blended light of both stars, the secondary giving 14.5 +/- 1.5% of it (Tkachenko et al. 2016, MNRAS 458, 1964, Table 4), so no archive spectrum is the primary's own, through the CIE 1931 2° observer: #a5bdff. Routes tried in order: stis-ngsl: skipped; gaia-xp: skipped; pulkovo: skipped; kiehling: skipped; kharitonov: skipped; burnashev: skipped; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 25,300 K and log g 3.75 (u1 0.092, u2 0.296): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Spica's orbit turns in its plane once every 139 years (Aufdenberg et al. 2007); it is drawn as the paper fixed it, at its 2007 epoch.
- **Not shown.** The position angle of the orbit's line of nodes on the sky is not measured; it is drawn at 0, a display convention.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
