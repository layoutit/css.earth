# GJ 1132

## Sources

Its radius and temperature follow Xue et al. 2024. The introduction is generated from Xue et al. 2024's published values; the sections below are the data's own.

**Star.** Placement: Gaia DR3 source 5413438219396893568, parallax 79.321 ± 0.018 mas (12.61 pc). Radius 0.2211 +/- 0.0069 solar radii from Xue et al. 2024, the stellar radius of the default parameter set of GJ 1132 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L...8X/abstract). Mass 0.1945 +/- 0.0048 solar masses from Xue et al. 2024, the stellar mass of the default parameter set of GJ 1132 b in the NASA Exoplanet Archive (https://ui.adsabs.harvard.edu/abs/2024ApJ...973L...8X/abstract). Temperature 3,229 K from Xue et al. 2024, the stellar temperature of the default parameter set of GJ 1132 b in the NASA Exoplanet Archive. log g 5.04 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 5413438219396893568, through the CIE 1931 2° observer: #ffc778. Routes tried in order: stis-ngsl: no HD number in SIMBAD; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret (2017), A&A 600, A30 computes from PHOENIX model atmospheres for the TESS band at 3,229 K and log g 5.04 (u1 0.153, u2 0.474): a model, because no fit of this star's limb is used.

**Brightness from MEarth.** The Color + brightness and Brightness map datasets are made in this project from the star's MEarth light curve of its 2014, 2015, 2016 and 2017 seasons (the newest of September 2016 to June 2017), from the MEarth Project's [Data Release 11](https://lweb.cfa.harvard.edu/MEarth/DataDR11.html): one point a night, after the segment baselines and the common mode of the paper's model are taken off it by that model's own code ([source record](../../sources/mearth-light-curves.json)). It is the light curve [Newton et al. (2018, AJ 156, 217)](https://arxiv.org/abs/1807.09365) judge, and the star's row in their table (VizieR J/AJ/156/217/table1) is their verdict that it shows the star turning: the period is theirs and nothing is judged here, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-29 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

**Brightness from MEarth.** Newton et al. (2018, AJ 156, 217) ask to see the sinusoid of their fit by eye in the star's light, over two or more complete cycles and uncorrelated with the systematics of their model (grade A when each of their questions is answered yes, grade B when one is not). Their table (VizieR J/AJ/156/217/table1) gives a grade A rotation period of 129.15 d, with a sinusoid of semi-amplitude 0.0041 mag in the star's longest dataset, of 681 nights: the star's period is 129.15 d, as published, and no criteria were applied to it here. The light varies by 0.76% (twice the semi-amplitude of the sinusoid the table prints). The light curve mapped is the star's longest dataset in the MEarth release, that of telescope 13: 681 nights before 2 March 2018, where the paper's table prints 681 for its longest. The paper's model, fitted to it here at 129.15 d by its authors' code, gives the sinusoid a semi-amplitude of 0.0024 mag, where the table prints 0.0041. The paper estimates the errors of its rotation periods at about 10%. The criteria of Holcomb et al. (2022, ApJ 936, 138), applied here to the star's TESS light, are not met: A valid period is found in 0 of the star's 6 sectors, and Holcomb et al. (2022) ask for at least 3. The star's record holds 122.3 d from the catalogues. The map's light curve leaves a scatter of 0.25% about the light, whose own noise is 0.18%. Gaia DR3 lists 3 other stars within 8 arcseconds, with 1.3% of their light and the star's together.

## Known problems

- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.
- **Model limb.** The limb darkening is a model atmosphere at the catalogued temperature and gravity, not a measurement of this star.
- **Not shown.** GJ 1132 c: found without a transit, and no paper's row measures its whole orbit together (period, eccentricity, periastron time and an inclination with an error bar) (found by radial velocity).
- **Quoted text.** The introduction quotes sentences of the Wikipedia article "GJ 1132" (revision 1374442266) verbatim, CC BY-SA 4.0.

- **Brightness from MEarth.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is of the first degree, one brighter and one darker side, which is what the sinusoid of the paper's model fixes: a finer pattern in the star's light, if there is one, is not drawn. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of September 2016 to June 2017: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
