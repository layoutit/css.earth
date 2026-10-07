# HD 181327

The [navigation marker](source/preparation/navigation.json) adds a prepared curvature cue to the existing neutral gray placeholder. It remains a schematic identifier without resolved surface imagery; the shading is a display convention, not measured limb darkening or surface detail.

## Sources

- **Placement:** Gaia DR3 source 6643589352010758400 (`source/photometry/gaia-dr3-source.csv`): ICRS position at J2016.0, parallax 20.931 ± 0.029 mas (47.78 pc, no zero-point correction), proper motion and radial velocity, propagated to the scene epoch by `@cssearth/astronomy`.
- **Radius and mass:** the Gaia DR3 FLAME values of the same source (`source/photometry/gaia-dr3-astrophysical-parameters.csv`): 1.372 solar radii (1.344–1.400) and 1.231 solar masses (1.191–1.271); Creevey et al. (2023, A&A 674, A26), Fouesneau et al. (2023, A&A 674, A28). GSP-Phot gives 1.376 solar radii and 6375 K in the same row.
- **Color:** the Gaia DR3 BP/RP sampled spectrum (`source/photometry/gaia-dr3-xp-sampled.csv`) through the CIE 1931 2° observer, the route [HD 189733 A](../hd-189733/README.md) uses: sRGB (238, 237, 255).
- **Rotation:** unmeasured. The display axis is celestial north in the plane of the sky (`source/preparation/rotation.json`).
- **The debris ring** is the attached volume [hd-181327-disc](../hd-181327-disc/README.md): six JWST/NIRCam coronagraph images of programme 2780 (Gáspár et al. 2026, [arXiv:2608.27437](https://arxiv.org/abs/2608.27437)) in the reflectance color of the paper's Figure 1, placed in depth on a disc fitted to them.

Catalogue color: the swatch that search, the catalogue and the minimap show is this dataset's prepared color, #eeedff.

**Limb.** The disc is dimmed toward the limb by the quadratic law Claret & Bloemen (2011), A&A 529, A75 compute from ATLAS model atmospheres for the Johnson V band at 6,375 K and log g 4.25 (u1 0.363, u2 0.310): a model, because no fit of this star's limb is used. Gravity: log g from the mass and radius in packages/astronomy/data/bodies/hd-181327.json: 4.254.

**Brightness from TESS.** The Color + brightness and Brightness map datasets are made in this project from the TESS mission's own 2-minute light curves of sectors 13, 67 and 94 (the newest of June and July 2025; their PDC-MAP flux, kept at [MAST](https://archive.stsci.edu/missions-and-data/tess)) ([source record](../../sources/mast-tess-light-curves.json)). They are the light curves [Holcomb et al. (2022, ApJ 936, 138)](https://arxiv.org/abs/2206.10629) use, and their criteria decide whether each shows the star turning: SpinSpotter, their code, measures it, and starry (Luger et al. 2019) makes the map that reproduces each ([method](../../../docs/stellar-brightness-maps-from-tess.md)). The map's table is built by `packages/telescope-cli/src/archives/tess/reduce.mts` and restored from the source cache.

## Evidence

- Run of 2026-09-21: [`object-package-consistency.test.mts`](../../../packages/telescope-cli/src/new-object/object-package-consistency.test.mts) checks that the catalogue color #eeedff is the color dataset's prepared color.

**Brightness from TESS.** Holcomb et al. (2022, ApJ 936, 138) ask the peaks of the light's autocorrelation to have a height over a quarter of their width, a width between 0.4 and 0.6 and a parabola fit over 0.9, in at least half the star's sectors and in all of them together. Sector 13 gives a period of 1.56 d from the autocorrelation, whose peaks have a height of 0.44, a width of 0.42 and a fit of 0.99; Sector 67 gives a period of 1.56 d from the autocorrelation, whose peaks have a height of 0.19, a width of 0.40 and a fit of 0.91; Sector 94 gives a period of 1.49 d from the autocorrelation, whose peaks have a height of 0.47, a width of 0.45 and a fit of 0.99; 2 more of the star's 5 sectors do not meet the criteria. All 5 together give a period of 1.47 d from the autocorrelation, whose peaks have a height of 0.35, a width of 0.43 and a fit of 0.98, which is the star's period: 1.47 d. The light varies by 0.15% (the range between its 5th and 95th percentiles). On the stars its authors inspected by eye, 4.9% of the periods these criteria accepted were false, and 6.2% on a second set. The star's record holds no catalogued rotation period to set it beside. The map's light curve leaves a scatter of 0.03% about the light, whose own noise is 0.01%. Gaia DR3 lists 27 other stars within 63 arcseconds, with 0.22% of their light and the star's together.

## Known problems

- The photosphere is a uniform color with a modelled limb: the star is 0.27 mas across and no image or limb measurement exists ([ledger](investigations.json)).
- The star's spin axis is not measured, so the sphere's axis is a display convention; the ring's own orientation is measured in the disc package.
- **Model limb.** The limb darkening is a model atmosphere at the star's temperature and gravity, not a measurement of this star.

- **Brightness from TESS.** Which longitudes are darker, and by how much, is measured. The latitude and shape of each patch are the smoothest that reproduce the light, and no color change of the spots is drawn. Color + brightness draws the contrast far stronger than it is, on the Brightness map's scale, so it can be seen; Brightness map has the measured values. No tilt of the axis is known, so the map is made at 60°, the middle tilt of axes that point at random. The map is of June and July 2025: spots come and go within weeks or months.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
