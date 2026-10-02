# Mu Cassiopeiae

## Sources

Its disc spans 0.972 milliarcseconds, which gives 0.79 solar radii and 5,264 K at its surface. It is also HD 6582, HR 321, HIP 5336. The introduction is generated from Boyajian et al. (2012), ApJ 746, 101's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 411413822074322432, distance 8 pc from Boyajian et al. (2012), ApJ 746, 101, HD 6582: the Hipparcos parallax the radius was computed with (van Leeuwen 2007), 132.4 +/- 0.6 mas, inverted; Gaia DR3's parallax, 130.288 ± 0.435 mas (299.7 standard errors), is not used. Radius 0.79 +/- 0.009 solar radii from Boyajian et al. (2012), ApJ 746, 101, HD 6582: radius in solar radii, from the limb-darkened angular diameter 0.972 +/- 0.009 mas (CHARA) and the Hipparcos parallax, 0.79 +/- 0.009 (https://doi.org/10.1088/0004-637X/746/1/101). No mass is measured, so GM is 0, the records' unpublished value. Temperature 5,264 K from Boyajian et al. (2012), ApJ 746, 101, HD 6582: effective temperature in K, from the angular diameter and the bolometric flux, 5264 +/- 32. log g 4.28 from 2025A&A...698A..93J ("A search for Maunder-minimum candidate stars.").

**Colour.** Gaia DR3 XP spectrum, source 411413822074322432, through the CIE 1931 2° observer: #fff0ed. Routes tried in order: stis-ngsl: HD 6582 is not in the library; pulkovo: HR 321 is not in the catalogue; kiehling: HR 321 is not among its 60 stars; kharitonov: HR 321 is not in the catalogue; burnashev: BS 321 is not in part2; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 5,264 K and log g 4.28 (u1 0.580, u2 0.179): a model, because no fit of this star's limb is used. Gravity: log g 4.28 from 2025A&A...698A..93J, the median of its 2 spectra; the 69 published values span log g 4.07 to 4.84, across which the limb law changes by at most 0.2% of the centre brightness.

## Evidence

Generated 2026-10-02 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.


## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
