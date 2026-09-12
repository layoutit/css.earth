# Amalthea

## Sources

- **Monochrome:** original Galileo SSI raw REDR images C0368603500 (1996-11-06, clear), C0420626379 (1997-11-06, green), C0420652501 (1997-11-07, clear), C0512324200 (1999-08-12, clear), C0532888100 (2000-01-04, clear).

- **Geometry / Elevation:** [Stooke Small Body Shape Models](https://sbn.psi.edu/pds/resource/stkshape.html), DOI 10.26033/yt84-5y91, `j5amalthea.tab`: west-positive, planetocentric 5°radius grid in kilometres. Original body origin is preserved.

## Evidence

- Original .IMG/.LBL files and per-frame [OPUS metadata](https://opus.pds-rings.seti.org/opus/#/target=Amalthea) are pinned. Body Sun/observer coordinates and range use recomputed OPUS geometry, checked against phase and angular scale.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Amalthea (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

- The single green frame supplies a monochrome brightness view, not inferred visible color. No flat-field or radiometric calibration is claimed; this is a display of approximate normalized brightness, not measured albedo.

- This is approximate registration, not a new photogrammetric solution. The closest observation withholds five source pixels next to known sky/invalid boundaries to reflect that uncertainty; valid lower-resolution imagery supplies overlap.

- **Faithfulness status:** The Monochrome lens is retained as a coarse observation and pointing aid, not as a feature-registered photographic surface. The existing shape and Elevation view remain the supported measured/model views.

- **Shape and elevation:** It describes overall shape, not altimetry or height above a geoid; unresolved/modelled regions and potentially exaggerated facets/depressions remain source limitations.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="amalthea-sources-and-presentation"></a>

Amalthea is a standalone Jupiter moon using the generic object package, shared lighting, world navigation and retained native PolyCSS triangles.

## Included

- Detector pixels, not enlarged press crops, supply the imagery. Closest image is about 2.4km/pixel; complementary aspects range to 8.3km/pixel.

- Meshoptimizer simplifies the 5040-triangle source to 800 native raster triangles with a 1500m library error setting. The source is Voyager-derived and corrects the historical 315°W bulge; it has no Galileo shape refinement. Elevation is radial distance minus 83.5km, displayed from −35 to +50km.

## Preparation

`source/preparation/terrestrial.json` owns the shared recipe. Source observations are original unsigned 8-bit detector DN, decoded after VICAR telemetry headers and row prefixes. Recorded empty/low-signal sky subtraction, a bounded lunar-Lambert approximation(maximum 2× gain; incidence ≤72°, emission ≤75°) and bounded overlap brightness matching (0.2–4× to reconcile different raw exposures) reduce photographed shading. Cast shadows and absent/unreliable samples are never reconstructed. A neutral gray grid marks gaps.

Some old archived raw labels have inconsistent Sun longitude/range. Conversely, OPUS image center and pole angles disagree with the original raw raster. Camera roll therefore uses the original PDS label NORTH_AZIMUTH+90°, following the [documented clockwise-from-image-right convention](https://pds.nasa.gov/datastandards/documents/dd/all/current/ch33s02.html); only center translation is fitted to illuminated source-shape boundaries. Typical residuals are 0.6–2.1pixels; the closest image is about 5pixels because the coarse Voyager shape differs from Galileo’s detailed limb.

Surface/pole atlases, native triangle maps, shared flood/directional lighting, thumbnails, scientific legend, small minimap and complete-silhouette context portrait derive from these same prepared sources. Flood displays the normalized source material without added directional attenuation; Shadows supplies the prepared Sun direction. Context gray areas preserve the known shape without inventing texture.

## Candidate survey

- [Galileo SSI archive](https://pds-rings.seti.org/galileo/ssi/) and the [2026 mission review](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf): surveyed all available Amalthea SSI entries; selected useful complementary aspects and best resolved clear frame. Repeated versions/nearby frames duplicate coverage. Several December 1996 frames contain sparse corrupted blocks and were excluded.

- September 1996 green/violet/756nm and November 1996 multi-band sequences: original detector frames inspected. The body is only tens of pixels across, with different gains/exposures, noisy background and no qualified registered/radiometrically normalized multiband product. They remain possible future Enhanced color work; raw channel stacking would misstate the color. No artificial red tint is painted onto the monochrome map.

- [NASA PIA01626 color comparison](https://www.jpl.nasa.gov/images/pia01626-comparison-of-amalthea-to-io/): useful color reference; display composite, without sufficient camera-band calibration/registration provenance for this mapped lens.

- [Stooke maps](https://sbnarchive.psi.edu/pds3/non_mission/EAR_A_3_RDR_STOOKEMAPS_V1_0/maps/): hand-drawn shaded relief, not an observational image mosaic; not used as photographic terrain.

- [Thomas shape archive](https://sbn.psi.edu/pds/resource/oshape.html): reviewed; its released target list does not include Amalthea. No alternative downloadable refined Galileo mesh was qualified.

- Juno detections offer context but do not improve Galileo’s resolved surface detail. No registered composition, thermal or local-altimetry dataset was qualified in the reviewed releases.

## Restoration and attribution

`source/preparation/acquisition.json` downloads exact archived camera frames, radius table, font and ESO panorama. Authored geometry/source interpretation and the pinned context derivative are checked in; the latter is reproducible with the shared radial snapshot preparer. Physical facts:[NASA Amalthea](https://science.nasa.gov/jupiter/jupiter-moons/amalthea/). Orbit/pole come from the shared vendored JPL astronomy package.

</details>
