# Achernar

## Sources

VLT and VLTI followed its companion for 13 years: the orbit weighs Achernar at 5.99 solar masses, with 15,539 K at its surface. It is also HD 10144, HR 472, HIP 7588. The introduction is generated from Kervella et al. (2022), A&A 667, A111's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 7588 (SIMBAD HD 10144); placed by that row, not by a Gaia source, distance 42.75 pc from Kervella et al. (2022), A&A 667, A111, Table 4: the Hipparcos parallax 23.39 +/- 0.57 mas (van Leeuwen 2007) the orbit is scaled with, inverted. Radius 8.14 +/- 0.26 solar radii from Kervella et al. (2022), A&A 667, A111, Table 4: radius of A 8.14 +/- 0.26 solar radii, from the mean limb-darkened diameter 1.770 +/- 0.035 mas (Domiciano de Souza et al. 2014) and the Hipparcos parallax (https://doi.org/10.1051/0004-6361/202244009). Mass 5.99 +/- 0.6 solar masses from Kervella et al. (2022), A&A 667, A111, Table 4: mass of A 5.99 +/- 0.60 solar masses, the orbit's total mass less B's model mass (https://doi.org/10.1051/0004-6361/202244009). Temperature 15,539 K from Kervella et al. (2022), A&A 667, A111, Table 4: Teff of A 15539 +/- 438 K. log g 3.39 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Achernar is HR 472., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 12 (BS 472) (1 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #aac3ff. Routes tried in order: stis-ngsl: HD 10144 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 472 is not among its 60 stars; kharitonov: HR 472 is not in the catalogue; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 15,539 K and log g 3.39 (u1 0.147, u2 0.292): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../src/objects/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Achernar A spins so fast that it is much wider at its equator than at its poles; it is drawn as a sphere of its mean radius.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
