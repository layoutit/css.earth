# V1358 Orionis

## Sources

V1358 Orionis is a young Sun-like star that turns in 33 hours. Between its maps of 2013 and 2017, its magnetic field flipped. It is also HD 43989, HIP 30030.

**The maps.** Willamo et al. (2022, A&A 659, A71, "Zeeman-Doppler imaging of five young solar-type stars", [arXiv:2110.06729](https://arxiv.org/abs/2110.06729)) observed it with HARPSpol on the ESO 3.6 m telescope in December 2017, and re-analysed a September 2013 dataset first published by Hackman et al. (2016), who had used an incorrect rotation period. They used Zeeman-Doppler imaging (ZDI), which maps a star's magnetic field from how its spectral lines are polarised as it turns, with the inversLSD code (Kochukhov et al. 2014). Their deposit, [VizieR J/A+A/659/A71](https://cdsarc.cds.unistra.fr/viz-bin/cat/J/A+A/659/A71), holds each map as 1876 equal-area surface cells in 38 latitude belts with the radial, meridional and azimuthal field and the brightness. This package shows them unchanged:

- **Radial field**, stepped Sep 2013 and Dec 2017: red where the field points out of the star, blue where it points in.
- **Meridional field**, stepped Sep 2013 and Dec 2017: the field running north or south along the surface.
- **Azimuthal field**, stepped Sep 2013 and Dec 2017: the field running one way or the other around the spin axis.
- **Brightness**, stepped Sep 2013 and Dec 2017: the photosphere's brightness relative to its unspotted surface; dark is spotted.

Each map uses its paper figure's color bar: the field linear from minus to plus the strongest value of any component in that map, through white at 0; the brightness from the map's darkest to its brightest point, in the figure's black-red-orange-white colors. A thin black line marks 59° S, below which the star never faces us, as the paper's horizontal line does. [latitude-belt-map.ts](../../../packages/bake/src/objects/raster/latitude-belt-map.ts) reads the tables and interpolates around each belt and between belts, so every cell keeps its deposited value.

**Directions.** The paper's Fig. 1 caption says the phases are inverted so that the map longitudes turn like the Earth's; its dashed lines sit at 360° × (1 − φ) for the observed phases φ of Table 1. So the maps' longitude is east longitude.

**Spin.** The maps were made with the axis tilted 59° from the line of sight and a 1.3571 d period (Table 2). The tilt is used, with the visible pole north. The axis's direction on the sky is unmeasured and set toward celestial north, and longitude 0 faces the Sun as a display convention.

**Star.** Placement: Gaia DR3 source 3116883781327753216, parallax 19.353 ± 0.022 mas (51.67 pc). Radius 1.05 solar radii from Vican & Schneider (2014), ApJ 780, 154, as listed by Willamo et al. (2022), Table 2 (https://arxiv.org/abs/2110.06729). Mass 1.059 (1.019 to 1.099) from Gaia DR3 FLAME (Creevey et al. 2023, A&A 674, A26; astrophysical_parameters of the same source). Temperature 6,032 K from McDonald et al. (2012), MNRAS 427, 343, as listed by Willamo et al. (2022), Table 2. log g 4.42 from the mass and radius.

**Color.** Gaia DR3 XP spectrum, source 3116883781327753216, through the CIE 1931 2° observer: #fdf7ff. Routes tried in order: stis-ngsl: HD 43989 is not in the library; pulkovo: no HR number; kiehling: no HR number; kharitonov: no HR number; burnashev: no HR (BS) number; gaia-xp: used.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,032 K and log g 4.42 (u1 0.410, u2 0.289): a model, because no fit of this star's limb is used.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 6, 33 and 87 (the newest of December 2024 and January 2025; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

Generated 2026-09-24 by [new-object-cli.mts](../../../packages/telescope-cli/src/new-object/new-object-cli.mts) from Gaia DR3, SIMBAD and the archives named above; each choice was read with the dataset's own reader.

Run of 2026-09-23 (this version):

- [`latitude-belt-map.test.mts`](../../../packages/bake/src/objects/raster/latitude-belt-map.test.mts) reads every deposited map and recomputes the largest and the mean total field over the equal-area cells. They match the paper's Table 3 to the gauss: v1358or2.dat: paper 154 G and 50 G, read 153.7 G and 49.8 G; v1358ori.dat: paper 195 G and 58 G, read 195.1 G and 58.0 G. So the files are the maps the paper measured.
- The paper's Table 3 also gives the correlation of brightness with the strength of each field component. Over the deposited cells: v1358or2.dat: paper (0.16, 0.01, 0.15), read (-0.15, 0.03, 0.16) (radial, meridional, azimuthal); v1358ori.dat: paper (0.55, 0.26, 0.07), read (-0.55, -0.26, 0.07) (radial, meridional, azimuthal). The sizes agree; the sign convention is not stated.
- `willamo-zdi-maps.png`: the radial field of September 2013 and December 2017 (the visible pole turns from red, field out, to blue, field in) and HD 29615's brightness, on this branch's dev server, headless Chrome at 1400 × 800 after the page reported ready.
- The reader's own tests check that a cell centre keeps its value, that the interpolation wraps at longitude 0, and that a table with a misplaced cell or belts out of order is refused.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 6 gives a period of 1.39 d from the autocorrelation, whose peaks have a height of 0.63, a width of 0.46 and a fit of 0.99; Sector 33 gives a period of 1.42 d from the autocorrelation, whose peaks have a height of 0.55, a width of 0.44 and a fit of 0.98; Sector 87 gives a period of 1.38 d from the autocorrelation, whose peaks have a height of 0.73, a width of 0.47 and a fit of 1.00. All 3 together give a period of 1.39 d from the autocorrelation, whose peaks have a height of 0.70, a width of 0.47 and a fit of 1.00, which is the star's period: 1.39 d. The light varies by 4.2% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds 1.36 d from the catalogues. The map's light curve leaves a scatter of 1.1% about the light, whose own noise is 0.18%. Gaia DR3 lists 31 other stars within 63 arcseconds, with 0.42% of their light and the star's together.

## Known problems

- **Only the large-scale field.** The inversion stops at spherical-harmonic degree 10, so smaller structures are not in the maps.
- **The far south is unseen.** South of 59° S the star never faces us, so the maps there hold no information from the data (paper, Fig. 2 caption, which the later map figures repeat).
- **Not shown.** The alternative maps with differential rotation in the paper's appendix are not deposited ([ledger](investigations.json)).
- **Assumptions of the frame.** The axis's position angle and the rotation phase are conventions.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. The map is made at the tilt the page draws, 59°. The map is of December 2024 and January 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
