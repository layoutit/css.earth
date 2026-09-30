# Dione

Dione is shown on the 2025 SPC shape model with a monochrome Cassini–Voyager mosaic, an enhanced-color map, elevation and relative albedo.

The [navigation marker](source/preparation/navigation.json) retains its existing source-map crop and silhouette, with the shared prepared full-phase curvature shading (35% ambient, 65% diffuse). It is a stylized identifier, not an observer projection or illumination at the scene epoch.

Shape-only views use the shared neutral gray (#808080 sRGB). This is a display convention, not a measurement of surface color or albedo; gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View | Source and interpretation |
| --- | --- |
| Monochrome | [USGS Cassini–Voyager mosaic](https://astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m), 2010, about 154 m/pixel. Exactly zero marks gaps; other dark pixels remain observed. |
| Enhanced color | [PIA18434](https://www.jpl.nasa.gov/images/pia18434-color-maps-of-dione-2014/), 2014. Ultraviolet/infrared colors extend beyond human vision; producer calibration, registration and photometric correction are retained. |
| Shape and Elevation | [Weirich et al. 2025 SPC V1.0](https://doi.org/10.26033/bxx6-g543); Elevation is radius minus 561.4 km, colored over −7.5 to +7.5 km. |
| Relative albedo | The same SPC release’s dimensionless brightness field, less validated than topography; not geometric albedo or calibrated reflectance. Its 0.5–1.5 display clips above 1.5. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/DIONE/target) Dione centre-point export, snapshot 2026-09-11, public domain. |

- The shape release is [Weirich, Gaskell, Palmer and Domingue (2025), Dione SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichdioneshape.html), NASA PDS.
- Paul Schenk calibrated, registered and photometrically corrected the images of the enhanced-color map.
- Two feature names carry the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption.
- The astronomy package supplies the Saturn-relative orbit, IAU orientation and the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 561.40 km. [NASA](https://science.nasa.gov/saturn/moons/dione/) rounds it to 562 km.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

The monochrome mosaic is 23040 × 11520 on a 563 km cartographic sphere. Preparation rolls its 180° E left edge by half a width without mirroring it. The enhanced-color map is 14134 × 7067 at about 250 m per pixel, starts at 0° E and is not rolled; all its pixels are kept. The photographic atlas samples each original grid directly with a 2 × 2 texel footprint and WebP quality 95 ([shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)).

The native Q128 OBJ has 98,306 vertices and 196,608 triangles. It is simplified to 2,000 faces under a 5,614 m display approximation ceiling (1% of the reference radius). Elevation is `radius * 0.001 - 561.4` km, read from a 2222 × 679 equatorial map (55° S–55° N) and two polar stereographic maps, with northwest relief shading. Relative albedo uses the same projections with no relief shading.

Named features are cast onto the shape model. Rim circles and extent boxes are not published nomenclature boundaries.

The iPad display atlases for the photographic, elevation and albedo views use quarter dimensions. This reduces display detail, not the resolution of the source observations or numeric grids.

## Evidence

- The simplified mesh is closed, with Euler characteristic 2. Its 8,000 one-way source-distance samples give maximum 4851.62 m, 95th percentile 2463.15 m and RMS 1298.41 m.
- Independent landmarks check orientation across the source maps: [Palinurus](https://planetarynames.wr.usgs.gov/Feature/4555) at 3.3° S, 63° W (297° E), and [Janiculum Dorsa](https://planetarynames.wr.usgs.gov/Feature/14379) near 24.6° N, 144.1° W (215.9° E). Bright trailing-hemisphere fractures lie near 90° E.
- Both photographic views were inspected with Shadows on and off in Chromium. This is a display check, not map-to-shape registration.

## Known problems

- Geographic registration, silhouette and feature review remain pending. No readiness is claimed.
- Different control networks, photographed shadows, seams and coarse inserts remain. No inpainting, synthetic color, polar repetition or patch correction is applied.
- Enhanced-color hemisphere differences reflect surface alteration and E-ring dust as well as residual shading.
- Model spacing is about 1.58 km. The producer's one-to-two-grid-spacing accuracy estimate comes from simulation experience, not per-cell Dione uncertainty. SPC sigma measures internal maplet agreement, not absolute height uncertainty.
- Small gaps near the 55° joins of the elevation maps remain marked rather than extrapolated.
- The physical radius (561.40 km), the monochrome map's 563 km projection sphere and the 561.4 km elevation datum are separate values.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
