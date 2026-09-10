# Mars sources

Mars uses Viking visible imagery, MOLA relief, THEMIS infrared observations, and modeled atmosphere charts.

## Sources

| View or quantity | Source |
| --- | --- |
| Visible surface | [Viking MDIM 2.1](https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg), colorized by NASA Ames |
| Elevation display | MOLA color relief from the [pinned OpenSpace tile source](source/manifest.json) |
| Infrared display | Mars Odyssey THEMIS daytime infrared mosaic, from the [pinned OpenSpace tile source](source/manifest.json) |
| Dimensions, placement and charts | USGS, OpenSpace, JPL and NASA PSG records below |

## Evidence

The camera section describes 201 independent reference samples. No dated test or browser-run report is cited; the source and acquisition records identify the inputs to those comparisons.

## Known problems

- THEMIS shows qualitative infrared response, not calibrated temperature or one observation date.
- Zero-valued edge fill is detected by a heuristic without an independent instrument mask. Gaps remain visible.
- Atmosphere lighting and the fixed camera/Sun reference are presentation models, not an epoch-specific observation.
- Phobos and Deimos are source archives here; Mars does not render them as embedded moons.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Measurements, camera and background sources</summary>

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
same continuous viewport-fit contract as Venus and Mercury. The planet
receives full zoom response. The cube has no zoom response, while the
separate Sun retains its measured angular size.

</details>

<details>
<summary>Visible, elevation and infrared surface processing</summary>

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

The THEMIS snapshot has opaque alpha, so alpha alone does not identify its
large black exterior. Its exact-zero fill connected to the north/south map
edges is conservatively marked unavailable. Isolated black terrain and every
nonzero dark sample remain; no 64-DN brightness cutoff is used. This is a
qualified source-fill interpretation, not an instrument validity mask.
Validity is resolved before resampling. The thermal surface, polar tiles and
thumbnail show the shared gray grid in gaps, with no Viking substitution,
blurred coverage transition or polar inpainting. The mosaic combines multiple
observations and does not depict the scene date or calibrated temperature.

There is no Mars cross-section, methane lens, or fabricated interior view.

</details>

<details>
<summary>Atmosphere model and charts</summary>

## Atmosphere and charts

The atmosphere presentation is constrained by the checked OpenSpace Mars
atmosphere configuration and NASA's description of a thin, dusty atmosphere.
One fixed reference projection uses the same source-radii oblate mesh as the
retained body. The material uses Saturn's accepted 1.002 coverage
margin and 0.992 content scale, then clamps its final alpha to a four-sample
prepared hull of the 32-longitude Mars mesh. The measured Hubble limb therefore
stays inside the rendered globe silhouette instead of forming an independent
screen-space halo.
The prepared material plane is retained inside the body's 3D scene and axial
frame. Its prepared depth transform and shared camera counter-rotation keep
the source-calibrated material aligned through arbitrary pitch and yaw.
The reflectance spectrum and temperature-pressure profile are prepared from a
pinned NASA GSFC Planetary Spectrum Generator configuration and raw I/F
response. The charts are static SVG outputs. The browser performs no PSG
request or scientific calculation.

</details>

<details>
<summary>Moon archives and editorial references</summary>

## Phobos and Deimos

The checked OpenSpace GLB models preserve the irregular source shapes of
Phobos and Deimos. Their scene axes are cross-checked against OpenSpace's
planet-owned globe assets. The [JPL satellite tables](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html)
identify Phobos and Deimos. Mars’s information panel records two moons. The
OpenSpace scene record pins the MAR097 SPICE kernel used by that source scene.

These are physical/source records, not rendered satellites in the Mars scene.
The earlier `mars-moon-billboards.webp` and `mars-moon-billboards@2x.webp`
outputs had no runtime resource or retained-node consumer. They are omitted
from the consumer-derived runtime inventory; no satellite rendering is added.

## Editorial information

Build-time editorial information comes from NASA Science topic `107740` and
its structured block endpoint. The prepared snapshot is committed at
`data/planets/mars.json`. The browser never requests or parses NASA editorial
services.

</details>

<details>
<summary>Prepared runtime boundary and source restoration</summary>

## Runtime boundary

All browser assets are generated under `public/scenes/mars/` and enumerated by
`runtime-assets.json`. Authoritative inputs and pinned capability recipes stay
under `source/`; generated runtime transport and supporting plans stay under
`prepared/`. The shared `tools/objects/terrestrial-layers/` operators prepare
affine ellipsoid texels, observed lenses, measured celestial registration,
source-calibrated atmosphere and bounded material rows. Shell content and
scientific charts use the common content preparer. The body package contains
no executable preparation or runtime code. No source-authority request is
permitted at runtime.
The material transport retains at most three decoded row shards. During input,
it publishes the nearest ready prepared state while the exact Sun phase state
decodes, then settles on the exact state. Runtime only selects a prepared phase
and publishes its screen roll; it does not rasterize, derive lighting, or add an
idle JavaScript loop.

## Reproduction commands

The [acquisition plan](source/preparation/acquisition.json) restores pinned
OpenSpace, USGS and JPL files and tile mosaics, plus the NASA PSG configuration
and spectrum. Returned products must match their pins before replacing local
files. Camera/oracle records and coordinate-registration snapshots remain
checked-in provenance, not live queries.

See the [contributor guide](../README.md) for shared commands. Body checks live
under `tests/objects/unit/mars/`.

</details>

## Catalogue attribution

The visible mosaic retains its collective Viking-orbiter capture credit. The catalogue now distinguishes Viking 1 and Viking 2 and their orbiters and landers, but this pinned image alone does not identify its individual contributors. The Missions tab presents that limit without assigning the mosaic to the landers or guessing individual mission links. See the [shared catalogue contract](../../../docs/architecture/exploration-catalog.md) and this body’s [source manifest](source/manifest.json). Dataset bytes and rendering are unchanged by this metadata migration.
