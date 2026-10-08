# Kaus Australis

## Sources

Its polarized light fits a star of equatorial radius 8.8 solar radii and polar radius 6.0, with poles near 11,700 K and an equator near 7,400 K. It is also HD 169022, HR 6879, HIP 90185. The introduction is generated from Bailey et al. (2024), ApJ 972, 103's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 90185 (SIMBAD HD 169022); placed by that row, not by a Gaia source, distance 43.94 pc from Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, HIP 90185: the Hipparcos parallax (van Leeuwen 2007) the radius is computed with, 22.76 +/- 0.24 mas, inverted. Radius 7.75 solar radii from Bailey et al. (2024), ApJ 972, 103, Table 5, the model the paper calls Best: equatorial radius 8.80 (2-sigma range 8.47 to 8.89) and polar radius 6.01 (5.90 to 6.08) solar radii, from a rotating Roche model fitted to the star's polarization, its spectral-energy distribution, its projected rotation speed and the Hipparcos parallax; the record holds the volume-equivalent sphere of the two, 7.75 solar radii, and the scene draws the flattening (https://doi.org/10.3847/1538-4357/ad630b). No mass is measured, so GM is 0, the records' unpublished value. Temperature 9,460 K from Code, Davis, Bless & Hanbury Brown (1976), ApJ 203, 417, HD 169022: effective temperature 9460 +/- 220 K (Table 6), from the measured angular diameter and the star's flux from the ultraviolet to the infrared. log g 3.57 from 1980A&AS...40..199P ("An analysis of the Hauck-Mermillod catalogue of homogeneous four-color data. II.").

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Kaus Australis is HR 6879., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 247 (BS 6879) (0 levels apart at most, the threshold is 12), through the CIE 1931 2° observer: #bacdff. Routes tried in order: stis-ngsl: HD 169022 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 6879 is not among its 60 stars; kharitonov: HR 6879 is not in the catalogue; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 9,460 K and log g 3.57 (u1 0.250, u2 0.325): a model, because no fit of this star's limb is used. Gravity: log g 3.57 from 1980A&AS...40..199P, measured from the star's Stroemgren photometry: SIMBAD's compilation holds no spectroscopic gravity of this star.

**Shape.** A Roche surface flattened by rotation, 8.8 solar radii at the equator and 6.01 at the poles, its pole 80 degrees from the line of sight at position angle 39.9 degrees, and gravity darkened by the law of Espinosa Lara & Rieutord (2011) from a 11,721 K pole: Bailey et al. (2024), ApJ 972, 103 (https://doi.org/10.3847/1538-4357/ad630b). The record is [gravity-darkening.json](source/photometry/gravity-darkening.json), each value with its table cell. It turns once in 38.6 hours; the scene does not turn it.

## Evidence

Generated 2026-10-08 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 0 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The pole is measured; the rotation phase is a convention, and the star is not turned.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** The edge-on model Bailey et al. (2024) list beside their best one (0.997 of the break-up rate, inclination 90 degrees, a 7,884 K equator), which they say the star's shell absorption might favor.
- **Not shown.** The thin gas disk around the equator that the paper infers from the polarization and the spectrum.
- **Not shown.** Which end of the axis leans toward us: polarization gives the axis's position angle, 39.9 degrees, not its sense, and no interferometric image of the star exists.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
