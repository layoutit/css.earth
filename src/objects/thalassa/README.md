# Thalassa

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

- **Shape model** uses [Karkoschka (2003)](https://doi.org/10.1016/S0019-1035(03)00002-2) published semi-axes of **54 × 50 × 26 km** (full dimensions 108 × 100 × 52 km).

- The reference radius is the conventional 40 km JPL/PCK value; it does not replace the measured axes.

## Evidence

- The query sorted by body-center resolution and its top candidate metadata/file URLs are preserved in [source/survey/](source/survey/).

## Known problems

- The unusually flattened ellipsoid is a model of the overall figure, not a measured terrain mesh. The standard gray no-coverage grid covers the complete model because no photographic surface map was qualified.

- This is a reference orientation, not a recovered local landmark registration.

- Existing meshoptimizer preparation reduces it to **480 native raster triangles**, with an 800 m error allowance and an estimated simplification error of about 474 m. This is a numerical preparation error, not measurement accuracy.

[Inputs](source/manifest.json) · Provenance (`prepared/provenance.json`) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

## Methods and source notes

<details>
<summary>Detailed source survey, assumptions and preparation</summary>

<a id="thalassa-sources"></a>

## Selected presentation

Its volume-equivalent radius is about 41.25 km.

There are no invented craters, colors, elevation or atmospheric layers. Flood and directional Shadows use the existing shared preparation and controls. Shape alone does not establish an elevation dataset.

The candidate dispositions and their source evidence are recorded in the [investigation ledger](investigations.json).

The OPUS query uses `surfacegeometrytargetlist=Thalassa`, rather than intended-target name: Voyager did not target Thalassa for close-up images. Recorded sensor sampling refers to original pixels; the 1,000 × 1,000 GEOMED output is geometrically resampled and adds no spatial information.

## Geometry and preparation

`source/measurements.json` defines the measured semi-axes, coordinate frame and exact radial formula. `source/shape/ellipsoid.tab` samples that analytic ellipsoid at 10-degree longitude/latitude intervals, in kilometres and east-positive longitude. X is the synchronous Neptune-facing long axis, Y is the in-plane intermediate axis, and Z is the short polar axis. PCK00011 provides pole and spin conventions; its older spherical `BODY804_RADII = (40 40 40)` is deliberately not the shape source.

The source grid has 614 welded vertices and 1,224 triangles. Shared preparation bakes the grid, smooth lighting, native triangle atlases, thumbnail, purpose-sized minimap and complete silhouette context portrait.

`source/material/neutral.png` is entirely RGB160. Every pixel is explicitly marked missing by `validity.noData: 160`; this is an authored sentinel, not a brightness threshold applied to astronomical observations. The existing shared missing-coverage painter produces the visible grid. All 131,072 samples in the 512 × 256 prepared map are no-coverage samples.

## Provenance and restoration

Scientific measurements: Erich Karkoschka (2003), DOI **10.1016/S0019-1035(03)00002-2**. The equation and sampled model are cssEarth-authored representations of the reported numbers; no publisher figures or invented surface imagery are redistributed. Survey metadata is NASA/JPL mission archive data provided by the PDS Ring-Moon Systems Node. NASA Science supplies the discovery and overview facts. IAU/WGCCRE through NAIF supplies the body orientation; the shared astronomy package supplies navigation ephemerides.

Required model, neutral sentinel, metadata and preparation documents are checked in and pinned in `source/manifest.json`. The shared font input restores through `source/preparation/acquisition.json`. Rejected survey images are not runtime or source-preparation dependencies; their original URLs and observation metadata are retained.

</details>
