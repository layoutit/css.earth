# Dione

Dione is shown on the IAU triaxial ellipsoid with a monochrome Cassini–Voyager mosaic, an enhanced-color map, elevation and relative albedo.

The [navigation marker](source/preparation/navigation.json) retains its existing source-map crop and silhouette, with the shared prepared full-phase curvature shading (35% ambient, 65% diffuse). It is a stylized identifier, not an observer projection or illumination at the scene epoch.

Gaps within photographic and scientific datasets retain the missing-data grid.

## Sources

| View | Source and interpretation |
| --- | --- |
| Monochrome | [USGS Cassini–Voyager mosaic](https://astrogeology.usgs.gov/search/map/dione_cassini_voyager_global_mosaic_154m), 2010, about 154 m/pixel. Exactly zero marks gaps; other dark pixels remain observed. |
| Enhanced color | [PIA18434](https://www.jpl.nasa.gov/images/pia18434-color-maps-of-dione-2014/), 2014. Ultraviolet/infrared colors extend beyond human vision; producer calibration, registration and photometric correction are retained. |
| Shape | [IAU 2015 radii](https://doi.org/10.1007/s10569-017-9805-5), NAIF [pck00011](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc): 563.4 × 561.3 × 559.6 km, long axis toward Saturn. |
| Elevation | [Weirich et al. 2025 SPC V1.0](https://doi.org/10.26033/bxx6-g543); radius minus 561.4 km, colored over −7.5 to +7.5 km. |
| Relative albedo | The same SPC release’s dimensionless brightness field, less validated than topography; not geometric albedo or calibrated reflectance. Its 0.5–1.5 display clips above 1.5. |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/DIONE/target) Dione centre-point export, snapshot 2026-09-11, public domain. |

- The elevation and albedo release is [Weirich, Gaskell, Palmer and Domingue (2025), Dione SPC Shape Models and Assessment Products V1.0](https://sbn.psi.edu/pds/resource/weirichdioneshape.html), NASA PDS.
- Paul Schenk calibrated, registered and photometrically corrected the images of the enhanced-color map.
- Two feature names carry the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), credited in the caption.
- The astronomy package supplies the Saturn-relative orbit, IAU orientation and the [JPL satellite table](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html) mean radius of 561.40 km. [NASA](https://science.nasa.gov/saturn/moons/dione/) rounds it to 562 km.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Processing

The monochrome mosaic is 23040 × 11520 on a 563 km cartographic sphere. Preparation rolls its 180° E left edge by half a width without mirroring it. The enhanced-color map is 14134 × 7067 at about 250 m per pixel, starts at 0° E and is not rolled; all its pixels are kept. The photographic atlas samples each original grid directly with a 2 × 2 texel footprint and WebP quality 95 ([shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation)).

The globe is the IAU ellipsoid, drawn as 16 latitude bands of 32 leaves and two polar caps (452 leaves); the long axis takes the display radius and the other axes keep their ratios. Relief is not modelled on the globe; Elevation shows it. Until 2026-09-30 the globe was a 2,000-triangle reduction of the SPC Q128 OBJ; the [investigation ledger](investigations.json) records why it was replaced. Elevation is `radius * 0.001 - 561.4` km, read from a 2222 × 679 equatorial map (55° S–55° N) and two polar stereographic maps, with northwest relief shading. Relative albedo uses the same projections with no relief shading.

Named features are cast onto the ellipsoid. Rim circles and extent boxes are not published nomenclature boundaries.

The iPad display atlases for the photographic, elevation and albedo views use quarter dimensions. This reduces display detail, not the resolution of the source observations or numeric grids.

## Evidence

- Shape: at equal mean size, the vertices of the former 2,000-triangle Q128 mesh lie 0.17% of the radius from the ellipsoid (RMS), 0.78% at most; a sphere gave 0.25% and 1.08%. All 5,215 label anchor and outline points lie on the drawn surface within 0.01%.
- Independent landmarks check orientation across the source maps: [Palinurus](https://planetarynames.wr.usgs.gov/Feature/4555) at 3.3° S, 63° W (297° E), and [Janiculum Dorsa](https://planetarynames.wr.usgs.gov/Feature/14379) near 24.6° N, 144.1° W (215.9° E). Bright trailing-hemisphere fractures lie near 90° E.
- Both photographic views were inspected with Shadows on and off in Chromium. This is a display check, not map-to-limb registration.

## Known problems

- Geographic registration, silhouette and feature review remain pending. No readiness is claimed.
- Different control networks, photographed shadows, seams and coarse inserts remain. No inpainting, synthetic color, polar repetition or patch correction is applied.
- Enhanced-color hemisphere differences reflect surface alteration and E-ring dust as well as residual shading.
- Model spacing is about 1.58 km. The producer's one-to-two-grid-spacing accuracy estimate comes from simulation experience, not per-cell Dione uncertainty. SPC sigma measures internal maplet agreement, not absolute height uncertainty.
- Small gaps near the 55° joins of the elevation maps remain marked rather than extrapolated.
- The physical radius (561.40 km), the monochrome map's 563 km projection sphere and the 561.4 km elevation datum are separate values.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Delivered files](inventory.json) · [Credits](NOTICE.md)
