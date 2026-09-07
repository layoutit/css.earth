# Europa sources and presentation

Europa uses the shared object runtime, camera, shell, lighting placement, and
orbital view. Its package owns the imagery and prepared scene. It never mounts
inside Jupiter's scene.

Jupiter's context sprite uses a 1024-pixel crop of the credited Hubble image
from 5 January 2024. It uses the existing prepared marker contract and stays
sharp when Jupiter is large in Europa's sky. Its clouds and photographic
orientation are a historical observation, not a simulated view for the pinned
epoch. Source bytes are owned by Europa so installation is independent of Jupiter.
The scene is fixed at its preparation epoch and does not offer a rotation-speed
control. Camera motion, Shadows, and Orbit use the shared controls.

The [USGS Voyager/Galileo global mosaic](https://astrogeology.usgs.gov/search/map/europa_voyager_galileo_ssi_global_mosaic_500m)
is a 19,631 × 9,816 monochrome GeoTIFF on a nominal 500 m grid. Individual
observations range from about 200 m to 20 km per pixel. Differences in source
resolution, seams, and observed illumination remain visible. No color,
elevation, ocean, or thermal map is inferred from this image.

The GeoTIFF's cylindrical coordinates increase eastward, with a central
longitude of 180° and a left edge at 0°. Rows run north to south. Its projection
uses a 1,562,089.9658 m sphere; the rendered mean-radius sphere uses the
astronomy catalogue's 1,560.8 km physical radius. It is not a resolved shape model.

The explicit no-data value is zero. Preparation separates validity before
resampling to 4096 × 2048, uses alpha-aware resampling to keep missing black
from darkening adjacent observations, and withholds mixed boundary pixels.
The shared gray cartographic grid marks missing data. It is not invented terrain.
Band textures are reprojected for the shared projective surface geometry;
polar textures use the same map and hemisphere-specific longitude mapping.

The source already contains shadows. The Shadows setting adds approximate
spherical illumination; with Shadows off, a fixed curvature overlay gives
depth. Neither mode recovers unlit albedo or physically relights photographed
features. Europa's tenuous oxygen atmosphere does not justify a visible halo.

[NASA's Europa facts](https://science.nasa.gov/jupiter/jupiter-moons/europa/europa-facts/)
support the introduction, oxygen atmosphere, and approximate 671,000 km distance
from Jupiter. Magnetic evidence strongly suggests a subsurface salty ocean;
the ocean is not directly mapped by this globe. Radius, parent, orbital period,
and orientation use the checked-in astronomy package. Rotation is presented as
synchronous with Europa's approximately 3.55-day orbit. The 5.2 AU badge denotes
Jupiter's approximate mean distance from the Sun, not Europa's distance from Jupiter.

At the pinned preparation epoch, the orbital view uses Europa's parent-relative
state and Jupiter's gravitational parameter to prepare an ellipse focused on
Jupiter. The Sun retains its separate heliocentric position. The shared solar
view approximates planet centres using VSOP87 system barycentres; satellites
use the package's JPL mean Kepler elements, not a live high-precision ephemeris.
The photographed surface uses IAU body orientation without a manual rotation.

The sky uses the same ESO panorama, HYG catalogue, and ICRF preparation as
the existing solid bodies. Source hashes, origins, and licenses are pinned in
`source/manifest.json`; runtime files are listed in `runtime-assets.json`.

Reproduce with `node tools/objects/dist/operations.js acquire europa --refresh`, followed by
`node tools/objects/dist/prepare-authored.js europa --write`. Original imagery remains unchanged
and is excluded from Git. Preparation does not require another body's scene.

The **Enhanced color** lens uses the [USGS controlled Galileo observations](https://stac.astrogeology.usgs.gov/docs/data/jupiter/europa/galileo_individual_images/)
(CC0), by Bland, Weller and colleagues. It combines 756 nm infrared, 559 nm
green, and 404 nm violet as display red, green, and blue. This is not natural
color. The three sequences are G1ESGLOBAL01 (1996-06-28), 12ESGLOCOL01
(1997-12-16), and 14ESGLOCOL01 (1998-03-29).
Exact image dates, band identities, coordinates, source URLs and hashes are
pinned beside the source inputs.

These are calibrated 32-bit I/F images with corrected camera pointing, on an
east-positive cylindrical grid centred at 180°, radius 1,560,800 m. They have
not been photometrically corrected by USGS. Native grids range from 1.375 to 1.570 km
per pixel. Higher-density observations take priority. Color appears only where
all three bands from the same sequence have valid interpolation footprints;
zero no-data, ISIS special pixels, and incomplete boundaries are withheld.
After geometric normalization and the angle limits below, about 14.3% of the
sphere has usable three-band coverage. Preparation records its surface percentage
per observation. Observed monochrome
forms the base elsewhere; grayscale does not imply measured neutral color.
The gray cartographic grid appears only where both sources lack imagery. The
initial display transfer is max(I/F, 0)^(1/2.2) for every channel, after
linear I/F normalization. Values remain floating point through presentation
level matching, and are only then rounded to 8-bit. Bright corrected values
are not clipped before matching.
No monochrome detail is transferred into color. The newer controlled dataset
and the older monochrome mosaic have different positional accuracy.

The 28ESGLOCOL01 sequence (2000-05-22) was removed from this lens: its
13.832 km-per-pixel imagery covered sharper monochrome with a visibly blurred
insert. The lens now uses the monochrome base there, with no invented color.
Preparation applies one spherical
[Lunar–Lambert disk normalization](https://isis.astrogeology.usgs.gov/9.0.0/Application/presentation/Tabbed/photomet/photomet.html)
to every color image, with weights selected by observation:

| Observation | Disk weight L |
| --- | --- |
| 14ESGLOCOL01, March 1998 | 1 (accepted Lommel–Seeliger correction) |
| 12ESGLOCOL01, December 1997 | 0.5 |
| G1ESGLOBAL01, June 1996 | 0.5 |

For each band's surface point, `mu0` and `mu` are the cosines of incidence and
emission. The disk function is `D = (1-L)*mu0 + 2*L*mu0/(mu0+mu)`.
Linear I/F is multiplied by `D(reference)/D(observation)`, with reference
incidence 30° and emission 0°, before the fixed display transfer. The two mixed
weights reduce the remaining gradients without the stronger brightening of
pure Lambert in the compared patches. They are visual presentation choices,
not fitted physical scattering parameters. The [USGS Europa photometry study](https://www.hou.usra.edu/meetings/lpsc2022/pdf/1691.pdf)
motivated comparing Lambert; we do not apply its per-band albedo normalization.

All three bands must have incidence and emission at most 75°; otherwise the
observed monochrome base is used. This removes about 43% of the previously
displayed December color pixels and 25% of the June color pixels on the prepared
map. Those difficult edges are withheld, not recovered. There is no inferred
color or recovery of unobserved terrain.

`source/photometry/` binds all 20 controlled ISIS labels, including each exact
capture ET and body-orientation coefficients, to pinned
[JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html) geometric Sun and
Galileo vectors relative to Europa (ICRF, km, JDTDB). The raw API responses
and request URLs are checked in; labels are restored by the existing source
acquisition command. Preparation transforms the vectors using the label's
adjusted prime meridian (W0 = 36.054°) and
[NAIF PCK orientation equations](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/pck.html),
including nutation/precession. It does not use the older PDS label's west
longitudes. Horizons uses its archived Galileo trajectory and current planetary
ephemerides, rather than reproducing the original USGS SPICE kernel set exactly.
Preparation is offline and reproducible from these pinned inputs.

Both lenses retain the shared Shadows control and prepared globe lighting.
This is an approximate disk correction, not calibrated unlit albedo: there is
no phase-angle normalization, fitted Europa scattering model, terrain model,
or removal of cast shadows. Residual photographed shadows and seams can remain;
added globe lighting is approximate.

To soften brightness steps against monochrome, preparation fits one display
brightness multiplier per color sequence. The fit is the median ratio of
monochrome to color luminance (weights 0.2126, 0.7152, 0.0722), using co-located
valid pixels within a four-texel strip inside each color footprint. It applies
the same multiplier to all three display channels, capped by the brightest
channel in the entire sequence so highlights cannot clip. This preserves color
ratios and relative detail, subject to 8-bit rounding. No monochrome detail is
transferred, no missing data enters the fit, and no feathering or blending is
used. This is presentation matching against the contrast-adjusted monochrome
mosaic, not additional physical calibration; source I/F files are unchanged.
Remaining differences in color, lighting, resolution and positional accuracy
can still reveal the boundaries.

The NASA Trek/Jónsson 2015 color mosaic was rejected: its [author documents
fictional polar terrain and cloned gaps](https://www.planetary.org/articles/0218-mapping-europa),
and its [publication license restricts derivatives](https://www.planetary.org/space-images/color-global-map-of-europa).
None of its pixels enter the prepared package.

## Preparation ownership

This package contains authored JSON recipes, source provenance, and generated JSON.
Reusable observation masking, projection, lighting, celestial, and retained-scene
operations live in `tools/objects/terrestrial-layers/`; no package-local executable
preparer or runtime is required. Run `pnpm build:preparation` before the commands
above. Omit `--write` from preparation to generate an isolated comparison stage.

Delivery keeps the prepared HD texture dimensions. Surface and polar atlases use WebP quality 90 with full-quality alpha; source maps remain lossless. The shared photographic sky uses quality 95. Lighting stays lossless. Only the selected sky mode is requested on first view.
