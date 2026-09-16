# Makemake

## Sources

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

[NASA Science](https://science.nasa.gov/dwarf-planets/makemake/) supplies the approximate 715 km radius, 22.5-hour rotation, 305-year orbital period and 45.8 AU average distance. The display uses a sphere at that approximate radius. [Ortiz et al. (2012)](https://doi.org/10.1038/nature11597) measured projected occultation axes of 1,430 ± 9 and 1,502 ± 45 km. Those sky-plane measurements do not uniquely define a three-dimensional shape or spin pole; this package does not claim otherwise. The astronomy library retains its independently documented oblate approximation for orbital/capture metadata.

The surface is unresolved and is shown in the shared neutral gray (#808080 sRGB), a display convention rather than a measured colour or albedo. The Dataset panel exposes it as “Shape”; no terrain, texture or map is claimed.

## Evidence

Run of 2026-09-16 (this version): `node tools/objects/dist/prepare-authored.js makemake --write` prepared the package with the neutral gray shape lens; `node --test tests/objects/unit/makemake/runtime-contract.test.mts site/test/object-discovery.test.mts` passes.

The neutral surface has no nomenclature; the map edge is an arbitrary display longitude.

## Known problems

Display pole and meridian are arbitrary, explicitly recorded as such. The reported rotation period is content only and does not drive an invented ephemeris. Orbital placement uses the existing pinned JPL elements at the shared 2026-09-04 epoch.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

Preparation uses the shared raster path and generic object adapter: 16 latitude by 32 longitude segments, with prepared poles, 452 body quads plus one lighting quad (453 total). No runtime source parsing or rasterization. The surface is the neutral gray generated through the raster route’s `neutral-shape` science kind; no texture is sampled. Run `node tools/objects/dist/prepare-authored.js makemake --write` to prepare the package from its pinned source inputs.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 715 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 0.9375-day prograde rotation (NASA 22.5 h from measurements.json; display orientation arbitrary) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 20.00° initial pitch, -50.00° yaw, taken from the retired lane's camera). 

</details>
