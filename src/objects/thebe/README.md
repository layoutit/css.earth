# Thebe

## Sources

- **Monochrome:** original Galileo SSI clear-filter REDR frames C0368591600R, C0401759200R, C0401787200R, C0420691700R and C0532888400R.

- **Elevation:** Philip Stooke’s [PDS radius table](https://sbnarchive.psi.edu/pds4/non_mission/small_bodies.stooke.shape-models/data/j14thebe.tab), DOI [10.26033/yt84-5y91](https://doi.org/10.26033/yt84-5y91). Heights are radius minus a 49.3 km reference sphere, displayed over −15 to +15 km.

## Evidence

- Original `.IMG` and detached `.LBL` pairs are pinned in [source/manifest.json](source/manifest.json) and restored by [source/preparation/acquisition.json](source/preparation/acquisition.json).

- Earlier original labels have stale Sun longitude/range values inconsistent with their phase angles, so these quantities come from the recalculated OPUS geometry.

## Known problems

Named features: the IAU/USGS Gazetteer of Planetary Nomenclature centre-point shapefile for Thebe (retrieved 2026-09-11, public domain per its FGDC metadata) is pinned under `source/features/`. Preparation verifies the archive, reads the attribute table and datum, drops the albedo-feature type code, folds repeated rows, and converts each positive-east centre into the body-fixed frame the radial terrain sampler uses for this mesh (longitude 0 toward the mesh +y axis, 90° E toward +x, north +z), then casts that direction through the prepared hit mesh so every anchor and outline point sits on the shape model rather than on a reference sphere. Craters and faculae trace a rim circle, other types their published extent box. Outlines are not published nomenclature boundaries. The frame was confirmed on Mimas and Phobos, where Herschel and Stickney fall at local minima of the shape radius.

- The closest frame is 1.96 km/pixel (about 50–60 pixels across Thebe); other contributors are 5–9 km/pixel. The source is visibly soft/noisy and contains spacecraft compression artifacts.

- **Elevation:** This is the broad shape inferred from Galileo images, including modeled unseen terrain, not a local altimetry survey. The Stooke source itself may exaggerate depressions; its scientific uncertainty exceeds a rendering approximation's numerical precision.

- **Photometry:** The original data are 8-bit **digital numbers**, not calibrated radiance or I/F. These operations are empirical display correction, not calibrated albedo recovery; detector flat fields, exposure/gain calibration and a measured phase function are absent.

- The gray grid marks absent observation coverage, rather than treating all dark pixels as missing. A cast shadow cannot be inverted to recover terrain.

- **Faithfulness status:** The Monochrome lens is retained as a coarse observation, but its two-dimensional center translation and illuminated-outline fit do not establish surface-feature registration. Elevation remains the supported shape-derived view.

[Inputs](source/manifest.json) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md) · [Investigation ledger](investigations.json)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="thebe-sources-and-preparation"></a>

## Selected presentation

- Increasing atlas size does not add observations.

- Hillshade is derived from that same radius grid; the legend is unshaded.

The archived 5° grid uses planetocentric latitude, **west-positive longitude**, and radii in kilometres. The source coordinate origin is retained. The shared preparation welds poles/seams and simplifies 5,040 source triangles to 700 native PolyCSS raster triangles, with a 1.2 km meshoptimizer error allowance.

## Observation geometry and photographed shading

`source/geometry/registration.json` records OPUS target-centered observer and Sun coordinates, distance and native pixel scale. Galileo SSI azimuth increases clockwise from image right ([SSI archive specification](https://pds.nasa.gov/data/go-j_jsa-ssi-2-redr-v1.0/go_0018/document/cdvolsis.pdf)); camera north-from-up is `(NORTH_AZIMUTH + 90) % 360`. OPUS center and pole clock values do not align with the original REDR rasters and are not used. Only two-dimensional camera-center translation is fitted to the observed illuminated shape outline. Shape radii, scale, latitude/longitude and camera roll are unchanged.

Shared preparation skips VICAR telemetry and per-line prefixes, subtracts the recorded constant sky-background estimate, and applies bounded lunar-Lambert illumination normalization (weight 0.5, maximum gain 1.75, incidence/emission limits 75°). At a 2.5 cap, the 5,606 samples of C0532888400 normalized by more than 1.75 held 627 of the view's 629 saturated display samples, a white patch. The 1.75 cap withholds them and 3,617 more from C0401759200 and C0420691700; other frames fill most of those points, and area coverage stays at 65.1% (65.2% before). Overlap level matching, fitted where both frames see the surface within 70° of incidence and emission (widest gain 1.69), reduces brightness jumps while keeping the original image detail.

Source-aware visibility and shadow tests withhold geometrically unreliable or hidden samples. Normalized coverage is reused by the surface, poles, minimap and prepared context portrait. The shared flood lighting and directional Shadows remain enabled; no photographed terminator is substituted for application lighting.

## Candidate survey

| Candidate | Adds | Disposition |
| --- | --- | --- |
| [Galileo SSI archive/OPUS](https://opus.pds-rings.seti.org/opus/#/target=Thebe) | Best resolved photographic coverage from multiple longitudes | Four original clear-filter frames included. C0368591600 (November 1996) is excluded: Thebe is a 77-pixel lit crescent in it, and no level reconciles it with the other frames; without it their fitted levels span 1 to 0.59 instead of 1 to 0.20, and coverage falls from 78% to 65%. Repeated exposures/cutouts and lower resolution duplicates excluded. C0420644201's useful registration is unresolved and it is not used. |
| [Stooke PDS bundle](https://sbn.psi.edu/pds/resource/stkshape.html) | Released irregular radius model, 5° grid | Included as geometry and explicitly model-derived Elevation. |
| [NASA Juno SRU PIA26751, May 1, 2026](https://science.nasa.gov/photojournal/nasas-juno-misson-captures-jupiter-moon-thebe/) | New ~3 km/pixel image, comparable resolution and a later encounter | Useful source candidate; precise camera geometry/calibration and a registered science release remain unresolved. The display JPEG is not silently projected with invented coordinates. |
| [Denk et al., 2026, Fig. 10](https://tilmanndenk.de/wp-content/uploads/2026_SSR_DenkEtAl_IoMinorMoons.pdf) | Original image identifiers and orientation/resolution comparison | Used to cross-check Galileo survey and native north-down orientation; figure is not used as a texture. No separate mapped composition/geology product was identified in this release. |
| [Galileo/Thebe photojournal releases](https://science.nasa.gov/photojournal/best-images-yet-of-thebe-amalthea-and-metis/) | Presentation composites of selected spacecraft images | Native PDS originals used instead of reprojecting enlarged/rotated press panels. |
| Voyager observations | Earlier unresolved or very coarse views | No resolution or useful mapped coverage improvement over selected Galileo data. |

The selected views are distinct observation and shape-model products. No invented color, atmosphere, crater detail or extra lens is added. [NASA’s Thebe overview](https://science.nasa.gov/jupiter/moons/thebe/) and the pinned astronomy package supply facts and system placement.

## Preparation and credits

The shared authored preparation consumes `source/preparation/terrestrial.json`; no private runtime or preparation controller exists. Font and background credits are retained in `NOTICE.md` and source records.

</details>
