# Mars sources

**Surface elements.** The dataset selector groups Chlorine, Iron, Silicon, Potassium, Thorium under one entry. The existing arrows select each map with its own description, source and legend. Dataset IDs and direct links are unchanged. See [dataset groups](../../../docs/reader-text.md#dataset-groups) and the [browser check](evidence/dataset-groups/browser.json).

Mars shows Viking visible imagery, MOLA relief and THEMIS infrared observations on the shared raster lane used by Mercury and Venus, with modeled atmosphere charts and IAU nomenclature labels.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

The [navigation marker recipe](source/preparation/navigation.json) retains the existing credited image and crop, then prepares a circular alpha edge so the photographic background cannot cover surrounding objects. The same silhouette is used by its larger context image where configured.

## Sources

| View or quantity | Source |
| --- | --- |
| Visible surface | [Viking MDIM 2.1](https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg), colorized by NASA Ames |
| Elevation | [USGS MOLA numeric DEM](https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m), meters above the GMM-2B areoid |
| Infrared display | Mars Odyssey THEMIS daytime infrared mosaic from the [USGS Astrogeology WMS](source/manifest.json) |
| Surface limb | [Vincendon 2013](https://doi.org/10.1016/j.pss.2012.12.005), mean phase function from OMEGA and CRISM |
| Limb halo | [NASA Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/) single-scattering limb model, run locally ([profile](source/atmosphere/psg-limb.json)) |
| Dimensions, placement and charts | USGS, JPL and NASA PSG records below |
| Named features | [IAU/USGS Gazetteer of Planetary Nomenclature](https://planetarynames.wr.usgs.gov/Page/MARS/target) Mars centre-point export, snapshot 2026-09-11, public domain. IAU-adopted names with centre, diameter, extent and name origin; labels appear at the closest zoom only, and a selected feature stays labelled. |

## Evidence

The [26 September 2026 browser and delivery record](evidence/showcase/browser.json) identifies the tested revision and inventory. Every added dataset was selected and visually inspected; the four-body fresh installation restored 354 files (72,243,602 bytes) and verified every inventory digest. Existing image assets remain byte-identical. [geology](evidence/showcase/geology.png).

### Additional surface datasets (26 September 2026)

| View | Source, processing and limits |
| --- | --- |
| Geology | [Tanaka et al. (2014), USGS SIM 3292](https://pubs.usgs.gov/sim/3292/): 1,311 polygons and 44 units at 1:20,000,000. The existing categorical reader uses the published legend fills, recorded in [the colour table](source/geology/sim3292-colors.json), without blending unit values. |
| Water equivalent, chlorine, iron, silicon, potassium, thorium | [Odyssey GRS ELEMTS v1](https://pds-geosciences.wustl.edu/missions/odyssey/grs_elements.html), observations 4 June 2002–3 April 2005. Unsmoothed 5° bins retain their native boundaries, negative estimates and each product's missing cells. Water equivalent is hydrogen expressed as H₂O, not a map of exposed ice. Five maps use weight percent; thorium converts weight percent to ppm by multiplying by 10,000. |
| Magnetic field | [Langlais et al. (2019)](https://doi.org/10.1029/2018JE005854), degree/order 134, evaluated by pyshtools on the 3,393.5 km sphere of Figure 6b. This is a model inferred from MGS and MAVEN, with about 160 km resolution. The 0.5° grid displays radial field, blue inward and red outward, with zero neutral. |

The crust-thickness view uses `Mars-thick-Khan2022-39-2900-2900.dat`, the precomputed [Wieczorek et al. (2022) Figure 2 example](https://doi.org/10.1029/2022JE007298) from [Zenodo 6477509](https://zenodo.org/records/6477509). It assumes 39 km beneath InSight and uniform crust density of 2,900 kg/m³. Its mean is about 57 km; the full model family spans 30–72 km. This example is not a unique consensus model. The deposited 0.25° node grid spans 5.579–116.811 km, consistent with the paper’s rounded 6–117 km. [The converter](../../../packages/bake/cli/prepare-mars-crust.mts) only reverses rows and adds explicit coordinates for the existing Tecplot reader; it does not recalculate thickness.

The GRS value and uncertainty columns are decoded independently: a missing correction-factor error does not erase a concentration. The first four maps have 1,508 valid bins; potassium and thorium have all 2,592. Uncertainties remain in the original tables rather than becoming separate lenses. [Reader checks](../../../tools/objects/terrestrial-layers/pds-binned-table.test.mts) compare six published cells and exercise missing values, units, wrap and bin edges. Geology decoding finds all 44 declared units. The magnetic grid spans −8,365 to 11,206 nT; its coarser sampling is consistent with Figure 6b's reported extrema (−8,520 to 11,260 nT), not an exact reproduction of that figure's raster.

The [magnetic recipe](source/preparation/magnetic.json) is evaluated by [the preparation command](../../../packages/bake/cli/prepare-magnetic-map.mts) with the versions in [the toolchain record](../../../packages/telescope/toolchains/magnetic-toolchain.json). No harmonic evaluation occurs in the browser. Quantitative and categorical textures use the existing lossless lane; the 5° GRS grid is deliberately not smoothed.


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
- The THEMIS lens remains a USGS WMS snapshot (2026-09-16). MOLA now reads the numeric USGS DEM; its interpolated regions are inherited from that product.
- The disc law is Vincendon's mean surface law with the atmosphere removed, like the Viking map; dust haze is not drawn over the disc. Beyond the limb, the halo is a PSG model, not a measurement: single scattering only, with the Sun one degree above the tangent point's horizon, and one Mars Climate Database dust and ice snapshot, so the real halo may be brighter and changes with the season and dust storms (see the `limb-halo` and `exi-measured-limb-halo` ledger entries). The material disc is prepared for a sphere of the equatorial radius; the 0.6% polar flattening of the mesh stays inside the disc’s 0.992 content margin.
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

The photographic lenses are decoded and resampled with Lanczos3 to 4,096 by 2,048 texels
(`density-before-pack`; only the `@2x` level ships), packed into 16 latitude
bands with a 32-texel gutter as one 4,160 by 3,072 image, and encoded as WebP.
Each lens also gets a 1,024 by 512 pole image: two 512-pixel orthographic
projections, one per pole. Numeric lenses use nearest sampling; photographs
use bilinear sampling. The 21,339 by 10,670
Viking imagery is resampled directly from its source; the THEMIS snapshot is
already 4,096 by 2,048. MOLA samples a compact numeric grid with nearest
sampling and lossless encoding. No exposure or sharpening curve is applied.

- `Visible color`: USGS Viking MDIM 2.1 colorized global mosaic, about 1 km per
  pixel, NASA Ames color processing.
- `Elevation`: USGS MOLA numeric heights, colored by the declared −9,000 to
  22,000 m scale. The palette and legend are generated together; the former
  NASA Trek color-relief image no longer supplies this view.
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
0.98 plus one flood frame) with the accepted 1.002 coverage margin and 0.992
content scale. Visible lenses use the atmosphere material; the MOLA and THEMIS
lenses use a copy, the observation material. The material is a separate
retained plane fitted to the projected silhouette, not a plane inside the 3D
scene, so close zoom shows no depth-sorted wedge drop-outs. Runtime only selects
a prepared phase frame and writes its roll.

The disc is lit by the mean Mars surface law of
[Vincendon (2013)](https://doi.org/10.1016/j.pss.2012.12.005), fitted to Mars Express
OMEGA and MRO CRISM data with the atmosphere removed: Hapke (1993) with w 0.85,
17° roughness, a two-term Henyey-Greenstein function (b 0.12, backward fraction
0.6) and an opposition surge (B0 1, h 0.05), in
`source/photometry/vincendon-2013-hapke.json`. The Viking MDIM 2.1 map is high-pass
filtered and normalized, with no law of its own to invert, and is surface only,
like the law. The paper finds the same shape at every solar wavelength, so one
law lights all three channels. Relative to the flood-lit disc centre the limb
keeps three quarters of the centre's brightness ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)). The authored OpenSpace
Rayleigh and Mie tuning, its ambient term and the terminator ramp are removed.

Outside the disc, the halo comes from a NASA PSG limb profile of PSG's own Mars
template (the Mars Climate Database 5.3 profile PSG attaches, Millour et al. 2015,
with its dust and water ice), computed with a local nasapsg/psg container by
[acquire-psg-limb-table.mts](../../../packages/bake/cli/acquire-psg-limb-table.mts)
into `source/atmosphere/psg-limb.json`. It is the radiance of a 1 km beam along a
line of sight grazing the planet at each tangent altitude, with the Sun behind the
viewer, divided by PSG's own disc-centre radiance under an overhead Sun, in the
red (640-670 nm), green (530-560 nm) and blue (440-490 nm) bands. The halo starts
at the surface, and each frame lights it where the tangent point faces the Sun.
Relative to the disc centre (red, green, blue) it is 0.031, 0.058 and 0.069 at the
surface, brightest at 10 to 15 km (0.039, 0.075 and 0.089 at 10 km), 0.0019,
0.0052 and 0.0091 at 40 km, and below one ten-thousandth above 60 km; the dust
dims the lowest lines of sight.

Two PSG limits shape it. PSG computes limb lines of sight with single scattering
only ([PSG handbook](https://psg.gsfc.nasa.gov/images/help/handbook.pdf), p. 96),
so light scattered more than once is missing and the real halo may be brighter.
And its single-scattering limb receives no sunlight with the Sun exactly on the
tangent point's horizon (the answer is only thermal emission, near 1e-41), so the
Sun sits one degree above it, at a solar zenith of 89 degrees; in a spot check at
the surface, moving it one more degree changed the radiance by 0.4%. Each band is
the mean of 10 nm windows. The nadir uses PSG's multiple-scattering solver at NMAX
8 and LMAX 43, and the limb NMAX 0 and LMAX 43, what PSG asks for the dust. A
shorter phase function overstates the backscattered halo about ninefold (LMAX 10
against 43 at 460-470 nm). In wider windows PSG quietly switches to a two-stream
solver that ignores the tangent altitude, and the tool refuses every answer that
did not run the requested method.

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

## Numeric USGS grid

The selected native GeoTIFF, detached labels and compact-grid recipe are linked
from [the source manifest](source/manifest.json). The compact grid keeps native
samples; the display applies the declared units and palette. See the
[shared acquisition and independent-check method](../../../docs/usgs-numeric-surfaces.md).
No new terrain displacement is introduced.

## Numeric-map qualification

The [retained numeric checks](evidence/usgs-numeric/numeric-checks.json) bind
the compact input digests and tested processing files, count coverage, and
compare native byte samples at hemispheres, seams, extrema and gaps. Their
calibration check runs before the display coverage masks; it does not validate
the original instrument or scientific model.

The [fresh-install receipt](evidence/usgs-numeric/delivery.json) verifies 1,500
runtime files (210,933,400 bytes) across the 13 changed bodies and the shared
Sun world metadata, with no reused files. All 15 compact source grids restored
from the source cache with native fallback disabled and matched byte for byte.

The [browser evidence](evidence/usgs-numeric/browser.json) records the earlier
map descriptions, legends and retained scene. It includes screenshots; the
[validation record](evidence/usgs-numeric/validation.json) names the checks
and the local full-build limitation. These checks do not measure instrument
accuracy or establish how well readers understand the explanations.

The [current-main integration check](../moon/evidence/usgs-numeric/integration.json) records the
build, all 11 grouped selectors, source labels and phone playback. It explains
which earlier scientific and browser evidence still applies to this version.
