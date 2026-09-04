# Mars sources

## Scene measurements

The adapter pins OpenSpace commit
`56e29b54b8592084ff1fef47c2e08de0b22ce516` as its scene-configuration
reference. The checked `globe.asset`, `atmosphere.asset`, and `kernels.asset`
snapshots record Mars radii, atmosphere parameters, and the MAR097 SPICE
kernel selection. OpenSpace is a configuration and provenance reference. The
browser does not load OpenSpace data at runtime.

Mars uses the IAU-compatible equatorial and polar radii published with the
USGS Viking MDIM product: 3,396.19 km and 3,376.20 km. OpenSpace currently
renders its globe as a sphere, but its source includes the same commented
triaxial values. cssEarth retains the observed flattening rather than the
OpenSpace presentation simplification.

## Visible surface

The normal-color surface is the USGS Astrogeology Mars Viking MDIM 2.1
colorized global mosaic at approximately 1 km per pixel. Its product metadata
identifies NASA Ames color processing over the geometrically controlled Viking
MDIM 2.1 mosaic. Preparation resamples the checked source into seam-safe DPR 1
and DPR 2 texels. It does not sharpen or invent local surface structure.

The navigation marker uses the 2016 NASA/ESA Hubble
[full-disc Mars portrait](https://esahubble.org/images/heic1609a/). ESA/Hubble
publishes the image under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). cssEarth crops and
resizes it for the prepared navigation atlas and preserves the full source
credit in the scene.

## Observation lenses

Mars uses three source-backed surface lenses:

- `Normal`: USGS Viking MDIM 2.1 colorized global mosaic.
- `Elevation`: USGS MOLA pseudo-color shaded relief, acquired from the pinned
  OpenSpace TMS source and prepared into one local equirectangular snapshot.
- `Thermal`: USGS/ASU THEMIS daytime infrared global mosaic, acquired from the
  pinned OpenSpace TMS source and shown as a qualified visual representation
  of daytime thermal response, not a calibrated temperature retrieval.

There is no Mars cross-section, methane lens, or fabricated interior view.

## Atmosphere and charts

The atmosphere presentation is constrained by the checked OpenSpace Mars
atmosphere configuration and NASA's description of a thin, dusty atmosphere.
One fixed reference projection uses the same source-radii oblate mesh as the
retained body. The material uses Saturn's accepted 1.002 coverage
margin and 0.992 content scale, then clamps its final alpha to a four-sample
prepared hull of the 32-longitude Mars mesh. The measured Hubble limb therefore
stays inside the rendered globe silhouette instead of forming an independent
screen-space halo.
The prepared material plane is retained inside the same 3D scene and axial
frame as Phobos and Deimos. One prepared plane and fixed moon billboards use
the shared camera counter-rotation contract, so a foreground moon transit
remains in front of both the shadow and the atmosphere through arbitrary pitch
and yaw instead of being overpainted by a separate screen layer.
The reflectance spectrum and temperature-pressure profile are prepared from a
pinned NASA GSFC Planetary Spectrum Generator configuration and raw I/F
response. The charts are static SVG outputs. The browser performs no PSG
request or scientific calculation.

## Background sky, Sun, and camera

The retained background uses the generic cubic-sky standard first established
for Venus. ESO's 6,000 by 3,000 `eso0932a` photographic panorama by S. Brunier
(CC BY 4.0) is projected during preparation into six 1,024-square faces and six
2,048-square DPR-2 faces. Each density has one subdued standard presentation
and one higher-contrast presentation, for 24 prepared files but only six
retained face elements. The photographic levels and Galactic presentation
registration remain shared prepared values. Mars's standard bank compensates
for its narrower native field of view: preparation uses 0.68 diffuse gain and
0.40 compact-detail gain, selects the 5,000 strongest
photographic local maxima, and collapses each core to one logical face texel.
This mirrors Google Earth Pro's measured separate 5,000-point, fixed 4.5-pixel
catalogue pass without shipping Google catalogue, radial-response, shader, or
sky-map bytes. The higher-contrast bank preserves the complete 0.65-detail
photograph. HYG v4.1 remains a coordinate-registration audit; the visible
standard-bank point positions and colors come from the licensed ESO image.

The camera and Sun behavior are clean-room measurements from 201 headless
Google Earth Pro Mars samples. They establish a fixed 60-degree horizontal
field of view, one-to-one inverse sky rotation, zero sky zoom response, and a
separate fixed-angular-size Sun direction. Google sky, shader, and Sun pixels
are not shipped. The Sun is a repository-authored prepared raster mounted as a
separate retained billboard. A fully visible native longitude-50 sample is
bound to the default cssEarth camera, and the recovered inverse rotation moves
it thereafter. Its direction also selects and rotates Mars's source-calibrated
prepared shadow and atmosphere phase bank. The conversion from Google view
space to the prepared material basis is fixed as `[x, -y, -z]`, preserving the
screen side of the Sun while converting camera-forward `-z` to visible-surface
`+z`. This is a fixed oracle anchor, not an epoch-correct Mars observer sky or
ephemeris claim.

Camera input uses the shared unbounded accumulated `matrix3d` contract. Pointer
drag may continue through arbitrary pitch, yaw, and diagonal combinations; the
retained cube applies the inverse rotation. Initial zoom is selected from the
same continuous viewport-fit contract as Venus and Mercury. The planet and its
moons receive full zoom response. The cube has no zoom response, while the
separate Sun retains its measured angular size.

## Phobos and Deimos

The checked OpenSpace GLB models preserve the irregular source shapes of
Phobos and Deimos. Their scene axes are cross-checked against OpenSpace's
planet-owned globe assets. Physical mean radii and mean orbital elements come
from checked JPL Solar System Dynamics MAR099 snapshots. The separate
OpenSpace scene snapshot pins the MAR097 SPICE kernel used by that source
scene; it is not the authority for the prepared mean-element table.

The scene declares readability scaling for both moons. It preserves their
relative orbital order and source shapes but does not claim screen distance or
screen diameter are physically to scale.

## Editorial information

Build-time editorial information comes from NASA Science topic `107740` and
its structured block endpoint. The prepared snapshot is committed at
`data/planets/mars.json`. The browser never requests or parses NASA editorial
services.

## Runtime boundary

All browser assets are generated under `public/scenes/mars/` and enumerated by
`runtime-assets.json`. Authoritative inputs stay under `source/`; generated
preparation intermediates stay under `.prepared/`. No source-authority request
is permitted at runtime.
The material transport retains at most three decoded row shards. During input,
it publishes the nearest ready prepared state while the exact Sun phase state
decodes, then settles on the exact state. Runtime only selects a prepared phase
and publishes its screen roll; it does not rasterize, derive lighting, or add an
idle JavaScript loop.
