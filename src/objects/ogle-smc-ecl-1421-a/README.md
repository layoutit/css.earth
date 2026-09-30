# OGLE-SMC-ECL-1421 A

## Sources

It has 2.72 solar masses and 17.7 solar radii; its partner has 2.85 and 23.8, measured from the eclipses and the stars' motions. The introduction is generated from Graczyk et al. (2020ApJ...904...13G)'s published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 4688970798174366464, distance 62,030 pc from Graczyk et al. (2020), ApJ 904, 13, the distance to OGLE-SMC-ECL-1421: 62.03 +/- 0.64 kpc; Gaia DR3's parallax, 0.058 ± 0.052 mas (1.1 standard errors), is not used. Radius 17.7 +/- 0.3 solar radii from Primary radius (solar radii) 17.7 +/- 0.3, as DEBCat (Southworth 2015, ASPC 496, 164) lists it from Graczyk et al. (2020ApJ...904...13G) (https://ui.adsabs.harvard.edu/abs/2020ApJ...904...13G). Mass 2.72 +/- 0.02 solar masses from Primary mass (solar masses) 2.72 +/- 0.02, as DEBCat (Southworth 2015, ASPC 496, 164) lists it from Graczyk et al. (2020ApJ...904...13G) (https://ui.adsabs.harvard.edu/abs/2020ApJ...904...13G). Temperature 5,395 K from Primary log Teff 3.732 +/- 0.008, as DEBCat (Southworth 2015, ASPC 496, 164) lists it from Graczyk et al. (2020ApJ...904...13G): 5395 K. log g 2.37 from Primary log g 2.37 +/- 0.01, as DEBCat (Southworth 2015, ASPC 496, 164) lists it from Graczyk et al. (2020ApJ...904...13G).

**Colour.** A Planck spectrum at 5,395 K, because no archive holds a spectrum of this star (stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number), through the CIE 1931 2° observer: #ffecde. Routes tried in order: stis-ngsl: no HD number in SIMBAD; gaia-xp: Gaia DR3 published no sampled BP/RP spectrum of it; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; planck: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,395 K and log g 2.37 (u1 0.522, u2 0.218): a model, because no fit of this star's limb is used.

## Evidence

Generated 2026-09-28 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** Masses, radii and temperatures as DEBCat (Southworth 2015, ASPC 496, 164) (https://www.astro.keele.ac.uk/jkt/debcat/) lists them from Graczyk et al. (2020ApJ...904...13G); Graczyk et al. (2014ApJ...780...59G).
- **Not shown.** SIMBAD knows the system as OGLE SMC-ECL-1421 but links no Gaia DR3 source; it is placed at the Gaia DR3 source 0.02 arcsec from SIMBAD's position, G = 16.97 against DEBCat's V = 17.18.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
