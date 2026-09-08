# Thalassa sources

## Selected presentation

**Shape model** uses Karkoschka’s published semi-axes of **54 × 50 × 26 km** (full dimensions 108 × 100 × 52 km). The reference radius is the conventional 40 km JPL/PCK value; it does not replace the measured axes. The unusually flattened ellipsoid is a model of the overall figure, not a measured terrain mesh. Its volume-equivalent radius is about 41.25 km.

The standard gray no-coverage grid covers the complete model because no photographic surface map was qualified. There are no invented craters, colors, elevation or atmospheric layers. Flood and directional Shadows use the existing shared preparation and controls. Shape alone does not establish an elevation dataset.

## Candidate survey

| Source | Decision and evidence |
| --- | --- |
| [Karkoschka (2003), Icarus 162, 400–407](https://doi.org/10.1016/S0019-1035(03)00002-2) | Included measured ellipsoid axes. The study uses barely resolved Voyager images to constrain overall shape; this does not yield resolved terrain. The publisher’s abstract and article preview supply the dimensions and observation limitations. |
| [PDS Voyager ISS / OPUS](https://pds-rings.seti.org/voyager/iss/), C1133759 and C1133806 | Downloaded and decoded original calibrated GEOMED products; inspected both. Narrow-angle clear images have about 24.07 and 24.05 km/native pixel and 61.44-second exposures. Thalassa’s major axis spans at most 4.5 native pixels before projection; visible features are motion trails. No usable registered surface appearance, so excluded as a photographic lens. |
| OPUS C1138527 and adjacent wide-angle sequence | Nominal best sampling is 20.19 km/native pixel, only about five pixels across the longest axis, with only 210 × 89 usable image samples recorded. Inspected original GEOMED; no resolved terrain. Excluded as a photographic lens. |
| [NASA overview image](https://science.nasa.gov/neptune/moons/thalassa/) | Discovery-context view at 5.9 million km with streaks caused by orbital motion. Useful history, not a surface texture. |
| [Stooke PDS shape release](https://sbn.psi.edu/pds/resource/stkshape.html) / USGS mapping search | The released Neptune grids are for Larissa and Proteus, not Thalassa. No detailed Thalassa terrain or registered geological/elevation map was qualified. |
| [HST astrometry and size study](https://www.nature.com/articles/s41586-019-0909-9) | Unresolved moon detections constrain orbit and brightness, not registered surface texels. The paper identifies the synchronous long-axis/short-axis convention used here. |
| [JWST inner-moon spectroscopy](https://pmc.ncbi.nlm.nih.gov/articles/PMC13418922/) | A relevant recent composition candidate, but disk-integrated spectroscopy is not a geographically resolved Thalassa surface lens. Not included as surface imagery. No claim that Thalassa has no spectral observations. |

The OPUS query uses `surfacegeometrytargetlist=Thalassa`, rather than intended-target name: Voyager did not target Thalassa for close-up images. The query sorted by body-center resolution and its top candidate metadata/file URLs are preserved in `source/survey/`. Recorded sensor sampling refers to original pixels; the 1,000 × 1,000 GEOMED output is geometrically resampled and adds no spatial information.

## Geometry and preparation

`source/measurements.json` defines the measured semi-axes, coordinate frame and exact radial formula. `source/shape/ellipsoid.tab` samples that analytic ellipsoid at 10-degree longitude/latitude intervals, in kilometres and east-positive longitude. X is the synchronous Neptune-facing long axis, Y is the in-plane intermediate axis, and Z is the short polar axis. This is a reference orientation, not a recovered local landmark registration. PCK00011 provides pole and spin conventions; its older spherical `BODY804_RADII = (40 40 40)` is deliberately not the shape source.

The source grid has 614 welded vertices and 1,224 triangles. Existing meshoptimizer preparation reduces it to **480 native raster triangles**, with an 800 m error allowance and an estimated simplification error of about 474 m. This is a numerical preparation error, not measurement accuracy. Shared preparation bakes the grid, smooth lighting, native triangle atlases, thumbnail, purpose-sized minimap and complete silhouette context portrait.

`source/material/neutral.png` is entirely RGB160. Every pixel is explicitly marked missing by `validity.noData: 160`; this is an authored sentinel, not a brightness threshold applied to astronomical observations. The existing shared missing-coverage painter produces the visible grid. All 131,072 samples in the 512 × 256 prepared map are no-coverage samples.

## Provenance and restoration

Scientific measurements: Erich Karkoschka (2003), DOI **10.1016/S0019-1035(03)00002-2**. The equation and sampled model are cssEarth-authored representations of the reported numbers; no publisher figures or invented surface imagery are redistributed. Survey metadata is NASA/JPL mission archive data provided by the PDS Ring-Moon Systems Node. NASA Science supplies the discovery and overview facts. IAU/WGCCRE through NAIF supplies the body orientation; the shared astronomy package supplies navigation ephemerides.

Required model, neutral sentinel, metadata and preparation documents are checked in and pinned in `source/manifest.json`. Shared font/starfield inputs restore through `source/preparation/acquisition.json`. Rejected survey images are not runtime or source-preparation dependencies; their original URLs and observation metadata are retained.

- Source restore: `node tools/objects/dist/operations.js acquire thalassa`
- Source verification: `node tools/objects/dist/operations.js acquire thalassa --verify-only`
- Preparation: `node tools/objects/dist/prepare-authored.js thalassa --write`
- Runtime installation: `pnpm setup:assets --object=thalassa`
