# Makemake

## Sources

[NASA Science](https://science.nasa.gov/dwarf-planets/makemake/) supplies the approximate 715 km radius, 22.5-hour rotation, 305-year orbital period and 45.8 AU average distance. The display uses a sphere at that approximate radius. [Ortiz et al. (2012)](https://doi.org/10.1038/nature11597) measured projected occultation axes of 1,430 ± 9 and 1,502 ± 45 km. Those sky-plane measurements do not uniquely define a three-dimensional shape or spin pole; this package does not claim otherwise. The astronomy library retains its independently documented oblate approximation for orbital/capture metadata.

The surface is the base-color image in the [NASA VTAD Makemake GLB](https://science.nasa.gov/resource/makemake-3d-model/), an illustration. It is not resolved surface imagery or measured topography. The original GLB and embedded UV coordinates are retained and reprojected at preparation time. The shared prepared full-phase curvature layer fits the projected sphere, separately from the original base-color atlas. No directional Sun shadow hemisphere is added. The original illustration can contain depicted relief. The Dataset and Surface Lens panels expose it as “Illustrative model.” No atmosphere layer, rings, or embedded moon scene is supplied.

## Evidence

Lane change (this PR): the shape-model lane was retired for Makemake; the same pinned inputs and the same decoders (`prepareGlbSurface` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — GLB cube-net texture reprojected to 2048 × 1024 by the retired lane. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; no nomenclature catalogue exists for this body. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js makemake --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/makemake/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (illustration) with no console errors or failed requests.

The illustrative texture has no nomenclature; the map edge is the texture's own 0° column, as the shape-model lane used.

No dated test report is cited in the existing source notes.

## Known problems

Display pole and meridian are arbitrary, explicitly recorded as such. The reported rotation period is content only and does not drive an invented ephemeris. Orbital placement uses the existing pinned JPL elements at the shared 2026-09-04 epoch.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

Preparation uses the shared shape-model path and generic object adapter: 16 latitude by 32 longitude segments, with prepared poles, 452 body quads plus one lighting quad (453 total). No runtime source parsing or rasterization. The source is a 2,048 × 1,536 cube-net image with six 512-pixel faces. It is reprojected to a 2,048 × 1,024 latitude/longitude image before packing; atlas gutters and pole remapping do not add source detail. The source mesh is a slightly irregular rounded illustration, within 1% of its fitted ellipsoid. That fit only transfers its UVs onto the displayed sphere; it is not a measured shape. Run `node tools/objects/dist/prepare-authored.js makemake --write` to prepare the package from its pinned source inputs.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 715 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 0.9375-day prograde rotation (NASA 22.5 h from measurements.json; display orientation arbitrary) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 20.00° initial pitch, -50.00° yaw, taken from the retired lane's camera). 

</details>
