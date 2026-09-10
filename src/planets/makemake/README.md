# Makemake

## Sources

[NASA Science](https://science.nasa.gov/dwarf-planets/makemake/) supplies the approximate 715 km radius, 22.5-hour rotation, 305-year orbital period and 45.8 AU average distance. The display uses a sphere at that approximate radius. [Ortiz et al. (2012)](https://doi.org/10.1038/nature11597) measured projected occultation axes of 1,430 ± 9 and 1,502 ± 45 km. Those sky-plane measurements do not uniquely define a three-dimensional shape or spin pole; this package does not claim otherwise. The astronomy library retains its independently documented oblate approximation for orbital/capture metadata.

The surface is the base-color image in the [NASA VTAD Makemake GLB](https://science.nasa.gov/resource/makemake-3d-model/), an illustration. It is not resolved surface imagery or measured topography. The original GLB and embedded UV coordinates are retained and reprojected at preparation time. The shared prepared full-phase curvature layer fits the projected sphere, separately from the original base-color atlas. No directional Sun shadow hemisphere is added. The original illustration can contain depicted relief. The Dataset and Surface Lens panels expose it as “Illustrative model.” No atmosphere layer, rings, or embedded moon scene is supplied.

## Evidence

No dated test report is cited in the existing source notes.

## Known problems

Display pole and meridian are arbitrary, explicitly recorded as such. The reported rotation period is content only and does not drive an invented ephemeris. Orbital placement uses the existing pinned JPL elements at the shared 2026-09-04 epoch.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

Preparation uses the shared shape-model path and generic object adapter: 16 latitude by 32 longitude segments, with prepared poles, 452 body quads plus one lighting quad (453 total). No runtime source parsing or rasterization. The source is a 2,048 × 1,536 cube-net image with six 512-pixel faces. It is reprojected to a 2,048 × 1,024 latitude/longitude image before packing; atlas gutters and pole remapping do not add source detail. The source mesh is a slightly irregular rounded illustration, within 1% of its fitted ellipsoid. That fit only transfers its UVs onto the displayed sphere; it is not a measured shape. Run `node tools/objects/dist/prepare-authored.js makemake --write` to prepare the package from its pinned source inputs.

</details>
