# Venus sources

Venus shows a cloud map, Magellan radar and elevation displays, modeled atmosphere charts, and Venera surface photographs.

## Sources

| View or quantity | Source |
| --- | --- |
| Clouds and atmosphere parameters | Pinned cloud texture and the authored atmosphere record described below |
| Radar and elevation | [USGS Magellan radar mosaic](https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_synthetic_color_mosaic_4641m) and [colorized topography](https://astrogeology.usgs.gov/search/map/venus_magellan_global_c3_mdir_colorized_topographic_mosaic_6600m) |
| Surface photographs | [PDS Venera collection](https://pds-geosciences.wustl.edu/missions/venera/) |
| Atmosphere charts | [NASA Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/) model |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/VENUS/target) Venus centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Both prepared levels, before → current |
| --- | --- |
| clouds | 110.0 → 117.6 kB |

These download sizes refer only to the polar sprites. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/venus/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](runtime-assets.json) bind the current preparation. Existing source-resolution and registration limits still apply.

The sky section records camera-fit comparisons. No dated test or browser-run report is cited.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Venus (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries, and the readout longitude counts from the map’s left edge, 180° from the Gazetteer origin. The map edge was fixed by cropping the source raster at a landmark’s Gazetteer centre under both hypotheses (see the pull request that added the feature).

Landing sites: 13 spacecraft landing, touchdown or impact sites are labelled beside the IAU names (`source/features/sites.json`). Each coordinate quotes the NASA NSSDCA, PDS, LROC, agency or paper page it was read from, with the stated latitude kind and longitude convention; sites are unsized points ranked like a 20 km feature and the caption shows the quoted source sentence with its publisher.

Feature notes: 112 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- Magellan colors are synthetic; they are not natural-color views.
- The atmosphere is a display approximation, and rotation is accelerated.
- The Magellan color source map has a darker one-pixel column at both its left and right edges (mean brightness 108 against about 124 beside them). A thin dark line can show along 180° E at close zoom.
- The Venera photographs include archive assembly and tonal processing. PDS distributes this material outside its formally archived collection.
- The camera and background sky do not represent an observer at a stated epoch.

[Investigation ledger](investigations.json) · [Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Planet facts, clouds and atmosphere display</summary>

## Planet facts and presentation

The user-facing facts come from the checked NASA Science snapshot in
`data/planets/venus.json`. The snapshot records its source URL, source ID,
publication modification time, retrieval date, and NASA credit. It supplies the
planet's 108 million km average distance, 12,104 km diameter, 225-Earth-day
year, 243-Earth-day retrograde rotation, approximately 3-degree tilt, 467 °C
surface temperature, 93-Earth-atmosphere surface pressure, and absence of moons
and rings.

The retained body uses the 6,051.9 km spherical radius stated in
`source/atmosphere/model.json`. The body
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

The default visible cloud deck is the Venus cloud texture pinned from the
OpenSpace project at commit `56e29b54b8592084ff1fef47c2e08de0b22ce516`; it is
an illustrative texture, and no source-backed global ultraviolet cloud mosaic
has been qualified to replace it (see the investigation ledger). The checked source JPEG is resized
without a color transform, projected into supersampled orthographic polar
tiles, and oriented for the retained projective latitude grid at preparation
time. Each reversed latitude strip has source-derived guard rows so projective
leaf interpolation cannot sample a non-adjacent strip. Polar texels use wrapped
bilinear sampling, exact spherical latitude projection, center averaging, and
antialiased coverage. The source is listed with its exact hash in `source/manifest.json`.

The fixed Venus material is a 32-frame prepared camera-pitch bank. Every frame
contains the light, terminator, and atmospheric response in one retained alpha
material. A matching lighting-only bank preserves illumination when the user
turns the atmosphere off. Runtime selects the nearest prepared frame and changes
the retained material address; it performs no lighting, scattering, geometry,
or raster math. The final view-aligned shadowless flood frame uses a prepared
0.30 shadow release, while the directional frames retain their existing 0.78
sunward exposure release. This keeps the flood-lit cloud deck below clipping
without changing directional-shadow behavior.

The atmosphere preparation reads the authored record
`source/atmosphere/model.json`, whose values are adapted from the OpenSpace
RenderableAtmosphere tuning and cited there: 6,051.9 km radius, 70 km height, 11.47 sun intensity,
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

</details>

<details>
<summary>Magellan radar and elevation processing</summary>

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

</details>

<details>
<summary>Modeled atmosphere charts</summary>

## Atmosphere charts

The two charts are generated from checked NASA GSFC Planetary Spectrum
Generator files. The reflectance chart contains all 253 response samples from
0.35 to 1.0 micrometers at resolving power 240. The temperature-pressure chart
contains all 100 ordered layers from the expanded configuration. The SVG files
carry machine-readable source, model date, units, ranges, and sample counts.
They are prepared files; the browser does not call PSG or derive chart geometry.

</details>

<details>
<summary>Venera photographs, processing and rights</summary>

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

</details>

<details>
<summary>Input verification and shared commands</summary>

## Reproduction

Every checked input and generated runtime asset is byte-bound by a committed
manifest. Runtime closure verification rejects undeclared or changed assets.
See the [contributor guide](../README.md) for acquisition and preparation commands.

</details>
