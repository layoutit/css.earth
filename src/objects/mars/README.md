# Mars sources

Mars shows Viking visible imagery, MOLA relief and THEMIS infrared observations on the shared raster lane used by Mercury and Venus, with modeled atmosphere charts and IAU nomenclature labels.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Sources

| View or quantity | Source |
| --- | --- |
| Visible surface | [Viking MDIM 2.1](https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg), colorized by NASA Ames |
| Elevation display | MOLA color shaded relief from [NASA Trek WMTS tiles](source/manifest.json) |
| Infrared display | Mars Odyssey THEMIS daytime infrared mosaic from the [USGS Astrogeology WMS](source/manifest.json) |
| Atmosphere material | [Authored atmosphere record](source/atmosphere/model.json) |
| Dimensions, placement and charts | USGS, JPL and NASA PSG records below |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MARS/target) Mars centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

Polar sprites now sample the pinned original photographs directly, preserving the declared coordinates and source gaps. Existing monochrome fallback is retained where a color view already uses it. Each sprite is 1024 × 512 pixels, the one prepared density; latitude-band images, geometry and lighting remain unchanged. [The shared preparation guide](../../../docs/surface-preparation.md#preserve-photographic-detail-through-preparation) describes the method and its limits.

| View | Polar sprite, one prepared level (`@2x`) |
| --- | --- |
| normal | 524,794 bytes |

This download size refers only to the polar sprite, as listed in `prepared/assets.json`. Decoded dimensions are unchanged. The scene matches [the previous main version](https://github.com/layoutit/css.earth/tree/3efdf2c9ed9047c72409b2730e879123f8c3b9d2/src/planets/mars/prepared); [the raster recipe](source/preparation/raster.json) and [asset inventory](inventory.json) bind the current preparation. Existing source-resolution and registration limits still apply.

The lane change was verified with the package, source-closure and browser conformance checks listed in the pull request that made it. No dated oracle report is cited for the new lane; the source and acquisition records identify every input.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Mars (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, converts each positive-east centre through `presentation/surface-map.json` with the map’s left edge at 180° E, and anchors it on the mesh; craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The map edge was fixed by drawing Gazetteer rims under both edge hypotheses and keeping the one where Olympus Mons and Hellas Planitia on the Viking MDIM mosaic coincide with the imagery.

Landing sites: 14 spacecraft landing, touchdown or impact sites and 2 published traverse paths are labelled beside the IAU names (`source/features/sites.json`). Each coordinate quotes the NASA NSSDCA, PDS, LROC, agency or paper page it was read from, with the stated latitude kind and longitude convention; sites are unsized points ranked like a 20 km feature and the caption shows the quoted source sentence with its publisher.

Feature notes: 644 of the labelled names carry a caption note, the lead summary of their English Wikipedia article (CC BY-SA 4.0, retrieved 2026-09-12), joined through Wikidata's Gazetteer id property and pinned with the article link and revision in `source/features/notes.json`; the caption credits Wikipedia beside the IAU naming year.

- THEMIS shows qualitative infrared response, not calibrated temperature or one observation date. The pinned mosaic (sha256 `1e9123a6…`) has fully black rows 0–28 (north of about 87.5° N) and rows 2034–2047 (south of about 88.8° S), and 2.6% zero samples overall. The shared raster lane has no source-validity mask, so those bands render black under the shared lighting; they are missing coverage, not dark terrain. The earlier gray grid and polar inpainting were features of the retired affine lane.
- The MOLA lens mosaic is stitched from NASA Trek zoom-3 WMTS tiles and the THEMIS lens is a USGS Astrogeology WMS GetMap of the global day-IR mosaic (2026-09-16); the source manifest pins those bytesed mosaics.
- The atmosphere is a display approximation from the authored scattering parameters in `source/atmosphere/model.json`, adapted from the OpenSpace RenderableAtmosphere tuning; it is not an epoch-specific observation. The material disc is prepared for a sphere of the equatorial radius; the 0.6% polar flattening of the mesh stays inside the disc’s 0.992 content margin.
- The camera and background sky do not represent an observer at a stated epoch.
- The first column of the Viking MDIM 2.1 color source map is nearly black (mean brightness 4 against about 100). A thin dark line can show along 180° E at close zoom.
- Phobos and Deimos are standalone bodies with their own packages.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

<details>
<summary>Shape, rotation and camera</summary>

## Shape and rotation

The recipe declares an ellipsoid with the IAU-compatible radii published with
the USGS Viking MDIM product and the JPL physical parameters pinned in
`source/editorial/factsheet-review.json`: 3,396.19 km equatorial and
3,376.20 km polar. The prepared mesh uses 230 units at the equator and
228.646218 units at the poles (the same ratio), 16 latitude bands and 32
longitude segments, the shared 50-pixel tile and the shared
[seam treatment](../../../docs/surface-preparation.md#reduce-geometry-and-bake-the-atlas):
a half-texel raster overscan and a stepped outset. The retained mesh is
authored 145° around its spin axis; the 25.19°
axial tilt and the 1.02595676-day sidereal rotation are recorded with the
body for the presentation, while the world frame, pole and prime meridian at
the shared epoch come from the IAU/WGCCRE rotation model in the astronomy
package through `src/platform/solar-geometry.mts`, as for every prepared body.
The 48-second visual rotation is an accelerated presentation choice.


## Camera

The prepared camera is the shared solar-system camera: default zoom 1.1, a
40-degree initial scene pitch over the shared 0-through-89-degree control
orbit, the continuous viewport fit shared with Mercury and Venus, and the
shared 60-degree horizontal field of view. The previous Google Earth
Pro-derived camera and material-depth contract were retired with the affine
lane.

</details>

<details>
<summary>Surface lenses and processing</summary>

## Raster preparation

Each lens is decoded and resampled with Lanczos3 to 4,096 by 2,048 texels
(`density-before-pack`; only the `@2x` level ships), packed into 16 latitude
bands with a 32-texel gutter as one 4,160 by 3,072 image, and encoded as WebP.
Each lens also gets a 1,024 by 512 pole image: two 512-pixel orthographic
bilinear projections, one per pole. The 21,339 by 10,670
Viking mosaic is resampled directly from its checked bytes; the MOLA and THEMIS
snapshots are already 4,096 by 2,048. No exposure or sharpening curve is
applied to any Mars lens.

- `Visible color`: USGS Viking MDIM 2.1 colorized global mosaic, about 1 km per
  pixel, NASA Ames color processing.
- `Elevation`: USGS MOLA pseudo-color shaded relief (false color) with the
  published palette legend.
- `Thermal infrared`: USGS/ASU THEMIS daytime infrared brightness mosaic,
  shown as a qualified visual representation of daytime thermal response, not
  a calibrated temperature retrieval. See the coverage limitation above.

The navigation marker uses the 2016 NASA/ESA Hubble
[full-disc Mars portrait](https://esahubble.org/images/heic1609a/). ESA/Hubble
publishes the image under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). cssEarth crops and
resizes it for the prepared navigation atlas and preserves the full source
credit in the scene. It is no longer used as a limb-brightness reference.

There is no Mars cross-section, methane lens, or fabricated interior view.

</details>

<details>
<summary>Atmosphere material, lighting and charts</summary>

## Atmosphere and lighting

The atmosphere material is the shared composite material used by Venus: a
32-frame phase bank (31 directional frames from light-view Z -0.98 through
0.98 plus one flood frame) derived from the authored atmosphere record
`source/atmosphere/model.json` (atmosphere height 76.98 km over a 3,386.19 km
source radius, Rayleigh and Mie coefficients and scale heights, average ground
reflectance 0.1). The material uses the accepted 1.002 coverage margin and
0.992 content scale and a 0-to-0.1 terminator smoothstep. Visible lenses use
the atmosphere material; the MOLA and THEMIS lenses use the observation
material, which carries surface lighting and the exterior limb only. The
material is a separate retained plane fitted to the projected silhouette, not
a plane inside the 3D scene, so close zoom shows no depth-sorted wedge
drop-outs. Runtime only selects a prepared phase frame and writes its roll.

The reflectance spectrum and temperature-pressure profile are prepared from a
pinned NASA GSFC Planetary Spectrum Generator configuration and raw I/F
response. The charts are static SVG outputs. The browser performs no PSG
request or scientific calculation.

</details>

<details>
<summary>Editorial references, runtime boundary and reproduction</summary>

## Editorial information

Build-time editorial information comes from NASA Science topic `107740` and
its structured block endpoint. The prepared snapshot is committed at
`data/object-information/mars.json`. Factsheet values cite the JPL references pinned in
`source/editorial/factsheet-review.json`.

## Runtime boundary

All browser assets are generated under `public/scenes/mars/` and enumerated by
`inventory.json`. Authoritative inputs and pinned recipes stay under
`source/`; generated runtime transport stays under `prepared/`. The shared
raster, celestial, geometry, content and presentation lanes in
`tools/objects/prepare-authored.ts` prepare the package; it contains no
executable code. No source-authority request is permitted at runtime.

## Reproduction

The [acquisition plan](source/preparation/acquisition.json) restores the pinned
USGS and Trek tile-mosaic files, the NASA PSG configuration and spectrum,
the Gazetteer archive and the sky and Sun inputs. Returned products must match
their pins before replacing local files. See the
[contributor guide](../README.md) for shared commands. Body checks live under
`tests/objects/unit/mars/`.

</details>

## Catalogue attribution

The visible mosaic retains its collective Viking-orbiter capture credit. The catalogue distinguishes Viking 1 and Viking 2 and their orbiters and landers, but this pinned image alone does not identify its individual contributors. The Missions tab presents that limit without assigning the mosaic to the landers or guessing individual mission links. See the [shared catalogue contract](../../../docs/architecture/exploration-catalog.md) and this body’s [source manifest](source/manifest.json).
