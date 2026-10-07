# ROXs 42B A

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

ROXs 42B A is the brighter of two young stars 146 parsecs away in Ophiuchus. They are 11 au apart and circle each other every 31 years on an orbit seen almost exactly edge-on (Inglis et al. 2026). The pair is orbited about 150 au out by the giant planet [ROXs 42B b](../roxs-42b-b/README.md). Its partner is [ROXs 42B B](../roxs-42b-companion/README.md). The "B" in the name is historical: ROXs 42B was the second optical counterpart of the X-ray source ROXs 42, and is not related to ROXs 42A.

## Sources

**Placement.** Gaia DR3 source 6047587937321868288 (Gaia Collaboration 2023): position at J2016.0, proper motion, and parallax 6.8284 ± 0.0309 mas, inverted to 146.447 pc ([source record](../../sources/gaia-dr3-roxs-42b.json)). Gaia does not resolve the pair, 83 mas apart: these are the photocentre's values (RUWE 2.1). This package places A there and B on its measured orbit around A. The radial velocity is Gaia DR3's, −0.68 ± 13.37 km/s, poorly measured.

**Radius and temperature.** 1.51 ± 0.02 solar radii and 3,650 ± 20 K, the SPHINX model-atmosphere fit to the pair's blended optical spectrum, modelled as the sum of the two stars by Inglis et al. ([2024](https://arxiv.org/abs/2402.09533), Table 1). Their text gives 1.42 and 1.59 solar radii for the two stars instead of the table's 1.51 and 1.39; the table is used.

**Mass.** 0.89 ± 0.08 solar masses, the photometric mass of Kraus et al. ([2014](https://arxiv.org/abs/1311.7664)). Inglis et al. (2026) measure the pair's dynamical total, 1.35 ± 0.07, which the two photometric masses match.

**Color dataset.** A Planck spectrum at 3,650 K through the CIE 1931 2° observer into sRGB with the D65 white. Gaia published no BP/RP spectrum of the pair. Its limb is darkened by the quadratic law Claret & Bloemen (2011), A&A 529, A75 computes from ATLAS model atmospheres for the Johnson V band at 3,650 K (the record) and log g 4.03 (from the record's mass and radius (packages/astronomy/data/bodies/roxs-42b.json)): a model, since no fit of this star's limb exists.

**Rotation.** None is measured on the sky; the display axis is celestial north ([rotation.json](source/preparation/rotation.json)).

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curve of sector 91 (April and May 2025; its PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). It is the light curve [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether it shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces it ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Run of 2026-09-23 (this version):

- [`hostedOrbits.test.ts`](../../../packages/astronomy/src/hostedOrbits.test.ts) puts B, on Inglis et al.'s (2026) orbit around this star, within 2.1 of its own error bars of all seven positions in their Table 1.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 91 gives a period of 0.83 d from the autocorrelation, whose peaks have a height of 0.69, a width of 0.48 and a fit of 1.00. The star's period is 0.83 d. The light varies by 13% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 4.4% about the light, whose own noise is 0.63%. Gaia DR3 lists 29 other stars within 63 arcseconds, with 8.9% of their light and the star's together.

## Known problems

- The radius is a model value, and the paper's text and table disagree on the two stars' radii (above).
- The pair's placement is Gaia's photocentre, not the centre of mass.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of April and May 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
