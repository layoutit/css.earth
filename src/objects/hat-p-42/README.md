# Lerna

## Sources

Its radius and temperature follow Boisse et al. 2013. The introduction is generated from Boisse et al. 2013's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 583455604761166848, parallax 2.416 ± 0.025 mas (413.93 pc). Radius 1.53 +/- 0.14 solar radii from Boisse et al. 2013, the stellar radius of the default parameter set of HAT-P-42 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...558A..86B/abstract). Mass 1.178 +/- 0.068 solar masses from Boisse et al. 2013, the stellar mass of the default parameter set of HAT-P-42 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2013A&A...558A..86B/abstract). Temperature 5,743 K from Boisse et al. 2013, the stellar temperature of the default parameter set of HAT-P-42 b in the NASA Exoplanet Archive. log g 4.14 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 583455604761166848, through the CIE 1931 2° observer: #fff1ed. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,743 K and log g 4.14 (u1 0.461, u2 0.259): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-10-03 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
