# Achernar

## Sources

Its equator is 1.35 times wider than its poles; 13 years of watching its companion's orbit weigh it at 5.99 solar masses. It is also HD 10144, HR 472, HIP 7588. The introduction is generated from Kervella et al. (2022), A&A 667, A111's published values; the sections below are the data's own.

**Star.** Placement: Anderson & Francis (2012), Astronomy Letters 38, 331 (XHIP), Hipparcos astrometry, VizieR V/137D/XHIP row HIP = 7588 (SIMBAD HD 10144); placed by that row, not by a Gaia source, distance 42.75 pc from Kervella et al. (2022), A&A 667, A111, Table 4: the Hipparcos parallax 23.39 +/- 0.57 mas (van Leeuwen 2007) the orbit is scaled with, inverted. Radius 8.286 solar radii from Domiciano de Souza et al. (2014), A&A 569, A10, Table 6: equatorial radius 9.16 +/- 0.23 and polar radius 6.78 solar radii, from the Roche-von Zeipel fit to VLTI/PIONIER data; the record holds the volume-equivalent sphere of the two, 8.286 solar radii, and the scene draws the flattening (https://doi.org/10.1051/0004-6361/201424144). Mass 5.99 +/- 0.6 solar masses from Kervella et al. (2022), A&A 667, A111, Table 4: mass of A 5.99 +/- 0.60 solar masses, the orbit's total mass less B's model mass (https://doi.org/10.1051/0004-6361/202244009). Temperature 15,539 K from Kervella et al. (2022), A&A 667, A111, Table 4: Teff of A 15539 +/- 438 K. log g 3.38 from the mass and radius.

**Color.** Pulkovo spectrophotometric catalogue, table 5 (320-1080 nm, 2.5 nm steps, 10 nm resolution, absolute flux in W m^-2 m^-1): Alekseeva et al. (1996, 1997), Baltic Astronomy 5, 603 and 6, 481; VizieR III/201. Achernar is HR 472., cross-checked against Burnashev (1985), Abastumani Astrophys. Obs. Bull. 59, 83; VizieR III/126, part2 record 12 (BS 472) (1 levels apart at most, the threshold is 12). Of the companion a double-star catalogue lists: Kervella et al. (2022), A&A 667, A111, Table A.1 measure Achernar B at 1.3 to 1.5% of A's flux at 0.554 um (SPHERE/ZIMPOL), under the 4.7% a color check allows; the Washington Double Star catalogue's magnitudes for the pair (KRV 54: 0.7 and 2.1) are not visible-band ones, through the CIE 1931 2° observer: #aac3ff. Routes tried in order: stis-ngsl: HD 10144 is not in the library; gaia-xp: the star is placed by a catalogue row, so no Gaia DR3 source is read for it; kiehling: HR 472 is not among its 60 stars; kharitonov: HR 472 is not in the catalogue; pulkovo: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 15,539 K and log g 3.38 (u1 0.147, u2 0.292): a model, because no fit of this star's limb is used.

**Shape.** A Roche surface flattened by rotation, 9.16 solar radii at the equator and 6.78 at the poles, its pole 60.6 degrees from the line of sight at position angle 216.9 degrees, and gravity darkened with exponent 0.166 from a 17,124 K pole: Domiciano de Souza et al. (2014), A&A 569, A10 (https://doi.org/10.1051/0004-6361/201424144). The record is [gravity-darkening.json](source/photometry/gravity-darkening.json), each value with its table cell. It turns once in 37.25 hours; the scene does not turn it.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from VizieR V/137D/XHIP and the archives named above; each choice was read with the dataset's own reader.

- The color's cross-check differs by 1 levels at most in any channel (threshold 12); [object-package-consistency.test.mts](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) recomputes it after preparation.

## Known problems

- **Assumptions of the frame.** The pole is measured; the rotation phase is a convention, and the star is not turned.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
