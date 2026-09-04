# Venus sources

## Planet facts and presentation

The user-facing facts come from the checked NASA Science snapshot in
`data/planets/venus.json`. The snapshot records its source URL, source ID,
publication modification time, retrieval date, and NASA credit. It supplies the
planet's 108 million km average distance, 12,104 km diameter, 225-Earth-day
year, 243-Earth-day retrograde rotation, approximately 3-degree tilt, 467 °C
surface temperature, 93-Earth-atmosphere surface pressure, and absence of moons
and rings.

The retained body uses the active 6,051.9 km spherical radius in OpenSpace's
pinned Venus `globe.asset`. The nearby 6,051.8 km polar value is commented out
in that source and is therefore not treated as active renderer input. The body
is represented by 448 prepared
projective texture leaves and two prepared polar leaves. The latitude rows,
polar projections, atlas addressing, source color, seam ownership, and DPR 1/2
rasters are all generated before runtime. The browser transports those values;
it does not construct geometry or sample source maps.

The 36-second cloud rotation and 96-second radar/elevation rotation are
explicit accelerated presentation choices. They are not physical-period
claims. Camera orientation is illustrative rather than an observer ephemeris.
The prepared default view uses the accepted Saturn camera contract: a 40-degree
rendered pitch, controlled from the shared 34.230769-degree input state over the
same 0-through-89-degree vertical orbit. Its prepared -105-degree default yaw
selects frame 28 of the 32-frame phase bank, placing just over 90% of the visible
disc on the illuminated side while retaining a narrow modeled shadow at the
right limb.

Viewport composition uses one continuous prepared aspect-ratio fit rather than
viewport buckets. The width share is 34% at a 0.75 portrait aspect ratio. A
cubic smoothstep raises it continuously to 42% for very narrow portrait screens
at or below 0.46, and a second smoothstep raises it to 36% by a square aspect
ratio. Landscape screens retain the 36% share. The body never exceeds 61% of
viewport height, and the resulting zoom is clamped from 1.4 through 2. The
shared shell uses its mobile bottom-sheet, navigation, and touch policy through
820 px. At 821 px it returns to the side-panel composition; through 960 px the
Venus camera keeps the same 175 px horizontal offset used beside the full
desktop information panel. The size curve itself has no viewport breakpoint:
adjacent 819, 820, and 821 px viewports remain continuous. The fit is evaluated
at mount and on viewport resize from the retained camera root's actual CSS
scale. A resize preserves the user's zoom ratio relative to the responsive base
instead of resetting the camera.
The full 0.42-through-4 interaction range remains available. Venus publishes
the camera mapping through the generic PolyCSS camera and orbit controls; it
does not copy Saturn's ring-and-moon-specific prepared matrix transport.

## Cloud view

The default visible cloud deck is OpenSpace's synchronized Venus cloud texture
and configuration, pinned to OpenSpace commit
`56e29b54b8592084ff1fef47c2e08de0b22ce516`. The checked source JPEG is resized
without a color transform, projected into supersampled orthographic polar
tiles, and oriented for the retained projective latitude grid at preparation
time. Each reversed latitude strip has source-derived guard rows so projective
leaf interpolation cannot sample a non-adjacent strip. Polar texels use wrapped
bilinear sampling, exact spherical latitude projection, center averaging, and
antialiased coverage. The source and pinned OpenSpace configuration are listed
with exact hashes in `source/manifest.json`.

The fixed Venus material is a 32-frame prepared camera-pitch bank. Every frame
contains the light, terminator, and atmospheric response in one retained alpha
material. A matching lighting-only bank preserves illumination when the user
turns the atmosphere off. Runtime selects the nearest prepared frame and changes
the retained material address; it performs no lighting, scattering, geometry,
or raster math. The final view-aligned shadowless flood frame uses a prepared
0.30 shadow release, while the directional frames retain their existing 0.78
sunward exposure release. This keeps the flood-lit cloud deck below clipping
without changing directional-shadow behavior.

The atmosphere preparation parses the checked OpenSpace values instead of
duplicating them: 6,051.9 km radius, 70 km height, 11.47 sun intensity,
ground reflectance and radiance, the three Rayleigh wavelengths and scattering
coefficients, 15.9 km Rayleigh scale height, the Mie scattering and extinction
coefficients, 5.42 km Mie scale height, and 0.85 phase value. The exterior limb
ends at the physical radius ratio `1 + 70 / 6051.9` rather than at a hand-sized
collar. Optical-depth color and opacity, altitude falloff, the terminator, and
view-dependent limb are prepared from those values. The material uses Saturn's
accepted 1.002 presentation coverage, 0.992 content scale, and analytic radial
limb clamp so the prepared atmosphere owns the smooth silhouette instead of
exposing the retained sphere facets. As with Saturn, this is a
source-parameter-bound display approximation, not a full spectral radiative-
transfer solver.

## Magellan radar and elevation views

The radar view uses USGS Astrogeology's public-domain `MAGELLAN_color` WMS
layer, the official C3-MDIR synthetic-color global mosaic. The elevation view
uses the matching `MAGELLAN_topography` WMS layer, the official C3-MDIR
colorized topographic mosaic. Acquisition requests the complete -180 through
180 degree longitude and -90 through 90 degree latitude extent in EPSG:4326 at
2,048 by 1,024 pixels. Verification fails if any checked response byte changes.

Radar and elevation use a separate prepared observation material. It applies
the same fixed source-bound lighting as the cloud view, omits optical cloud
opacity over the measured surface, and retains only the sourced 70 km exterior
atmospheric limb. This represents the instruments looking through or measuring
past the visible cloud deck without presenting Venus as airless. The browser
does not reduce material opacity, recompute lighting, or synthesize a surface
view when a lens changes.

USGS documents the source products as prepared global mosaics derived from
Magellan radar and topography. The embedded colors are part of those USGS
products; neither lens is a natural-color photograph. Preparation resizes,
sharpens, projects polar tiles, and orients the source for the retained grid. It
does not synthesize surface measurements or recolor the sources.

USGS product references:

- <https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_synthetic_color_mosaic_4641m>
- <https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_colorized_topographic_mosaic_6600m>

## Atmosphere charts

The two charts are generated from checked NASA GSFC Planetary Spectrum
Generator files. The reflectance chart contains all 253 response samples from
0.35 to 1.0 micrometers at resolving power 240. The temperature-pressure chart
contains all 100 ordered layers from the expanded configuration. The SVG files
carry machine-readable source, model date, units, ranges, and sample counts.
They are prepared files; the browser does not call PSG or derive chart geometry.

## Venera surface photographs

The Surface photos panel publishes the four historical panorama files listed by
the NASA PDS Geosciences Node: Venera 9 and 10 GIFs from 1975, and Venera 13
and 14 JPEGs from 1982. The checked files retain the institutional archive's
assembly, annotation, and tonal processing. They are not recolored, restored,
cropped, filtered, or recompressed by this repository. Preparation validates
each source hash and pixel dimensions, then copies the exact bytes into the
declared Venus runtime closure.

The source page credits the Vernadsky Institute and Moscow Power Institute and
states that the material is provided through PDS but is not formally archived
there. The UI and manifest preserve that distinction: the institutes receive
the image credit and PDS is named as the distributor. NASA Science's Venera 9
caption supports the qualified description that it is one of the first photos
returned from another planet's surface. Descriptions of visible rocks, soil,
calibration targets, and lander parts are conservative observations of the
checked files.

The committed `source/venera/RIGHTS.md` records the automatic-camera
public-domain basis and its limits. That qualification does not extend to later
colorization, geometrical correction, gap filling, AI enhancement, or other
creative restoration; no such derivative is included.

Source references:

- <https://pds-geosciences.wustl.edu/missions/venera/>
- <https://science.nasa.gov/resource/first-look-venus/>

## Background stars

The visible background is prepared from ESO's 6,000 by 3,000 pixel
`eso0932a` photographic panorama of the complete northern and southern sky.
The exact checked TIFF has SHA-256
`10f209ab83e1fd89e7fa1ed70277ffc6ed19c43549f04ec637c6806d98aff035`.
The visible credit is **ESO/S. Brunier**. ESO publishes the image under CC BY
4.0; `source/stars/ESO-IMAGE-LICENSE.md` records the source page, original-file
URL, credit, license, and qualification.

Preparation projects the 2:1 Galactic panorama into six 1,024-pixel and six
2,048-pixel cube faces. It fixes the image levels at an 8/255 black point, 1.2
gamma, and 0.6 gain. Before projection, preparation performs one horizontally
wrapped 9-pixel Gaussian separation of the checked photograph: it retains 0.85
of the broad diffuse layer and 0.65 of the source photograph's compact detail.
It then bakes the separate source-observed Sun into the same faces. The browser
selects one DPR bank before mount and only transports the prepared images
through six retained CSS faces. It performs no runtime projection, level
adjustment, rasterization, masking, filtering, blending, or gradient synthesis.

The level curve and separation are evidence-selected rather than
exposure-guessed. An 87-pose fit initially selected 2.2 compact-detail gain,
but the resulting field was rejected visually because its dense small-scale
contrast competed with Venus. The shipped 0.65 value retains the accepted broad
Galactic structure while restoring a planet-first visual hierarchy. Lower
whole-image gain trials and the rejected 2.2 detail bake are not part of the
runtime closure.

The panorama has one fixed prepare-time registration inside the cube:
`rotateX(-35.5deg)`, then `rotateY(158.5deg)`, then `rotateZ(-123deg)`. The
checked calibration tool fits that rotation against 24 widely separated poses
from the frozen Google sweep while excluding the planet silhouette and Sun.
It improves the low-resolution source-photo correlation from 0.09965 to
0.18668. This is a presentation registration, not an astronomical epoch claim.

HYG Stellar Database v4.1 remains a separate coordinate-registration source,
pinned at commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`. Acquisition verifies
the 119,626-row catalog and preserves a checked 60,000-star subset. Preparation
uses its declared ICRS camera basis to register the ESO image, including the
required Y-up-to-standard ICRS axis reorder before the IAU Galactic transform.
It does not draw a second catalog-star overlay because the photograph already
contains the visible stars. HYG is credited to David Nash / Astronexus and is
licensed under CC BY-SA 4.0; `source/stars/LICENSE.md` records that license.

This is a source-photographed full sky, not an epoch-correct sky as observed
from Venus. ESO notes that the panorama was assembled over months and that
planets moved between exposures. The scene claims neither a Venus observer
epoch nor an ephemeris-derived inertial orientation.

## Reproduction

Run the following commands from the repository root:

```sh
node src/planets/venus/tools/acquire.mjs --verify-only
node src/planets/venus/tools/prepare.mjs
```

Refreshing acquisition is explicit and never occurs in the browser:

```sh
node src/planets/venus/tools/acquire.mjs --refresh
```

Every checked input and generated runtime asset is byte-bound by a committed
manifest. Runtime closure verification rejects undeclared or changed assets.
