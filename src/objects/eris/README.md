# Eris

## Sources

The displayed surface is the illustrative [NASA VTAD Eris 3D model](https://science.nasa.gov/resource/eris-3d-model/), published April 22, 2019. Eris has no spacecraft surface map. Its pale crater texture is an illustration, not observed terrain, an albedo map, or a scientific lens. The Dataset and Surface Lens panels expose it as “Illustrative model.” No ring, atmospheric halo, or embedded Dysnomia scene is supplied.

The radius is 1,163 ± 6 km from the November 6, 2010 stellar occultation reported by [Sicardy et al. (2011)](https://doi.org/10.1038/nature10550). That event is consistent with a spherical body. The render sphere uses the nominal radius; it does not claim a resolved shape mesh. NASA’s model uses an approximately 500-unit sphere, normalized to the observed radius during preparation.

## Evidence

Lane change (this PR): the shape-model lane was retired for Eris; the same pinned inputs and the same decoders (`prepareGlbSurface` through the raster lane's `science` adapter) now feed the shared raster lane used by Mercury, Venus, Mars, the Moon and Pluto. The sphere is the shared 16 × 32 mesh (450 leaves, 230 units, 50-pixel tile, 0.005 overlap) with the 256-frame Lambert lighting bank and no atmosphere. Surfaces are painted at 2048 × 1024 (DPR 1) and 4096 × 2048 (DPR 2) — GLB base-colour texture is 2048 × 1024. Verified with the package, source-closure, minimap and browser conformance checks listed in the pull request; no nomenclature catalogue exists for this body. No new science review is claimed.

Run of 2026-09-12 (this version): `node tools/objects/dist/prepare-authored.js eris --write` prepared the package through the shared raster lane and `tools/objects/observation/interpret.mts`; `node --test tests/objects/unit/eris/*.test.mts` passes except the shared runtime-package and import-closure tests that fail identically on `main` (recorded once in the pull request).

A headless Chrome probe (`output/probe-spheres.mts`, ignored scratch) mounted the page on the dev server, selected every lens (illustration) with no console errors or failed requests.

The illustrative texture has no nomenclature; the map edge is the texture's own 0° column, as the shape-model lane used.

No dated test report is cited in the existing source notes.

## Known problems

Rotation content uses the 15.771 ± 0.008-day photometric period of [Bernstein et al. (2023)](https://arxiv.org/abs/2303.13445), consistent with synchronous rotation at Dysnomia’s 15.78590-day orbital period. This supersedes the 25.9-hour value still present on NASA’s overview. The illustration has no measured longitude origin or established spin-pole registration. Its display pole and meridian are explicitly arbitrary, and no absolute rotational ephemeris is animated. The existing vendored JPL elements determine orbital position at the shared preparation epoch.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

The original GLB contains one untransformed mesh with 20,508 triangles and one embedded 2,048 × 1,024 PNG base-color texture. Preparation preserves the authored mesh UV mapping while resampling that texture into the shared projective surface atlas. The delivery raster remains at source resolution. No normal map or PBR shader is reproduced. The shared prepared full-phase curvature layer fits the projected sphere and preserves flood illumination without adding a Sun-facing shadow hemisphere; any local relief shading already in the illustration remains illustrative.

The retained surface uses a 16 × 32 grid with prepared polar caps: 452 body quads plus one lighting quad (453 total), below the 2,000-quad budget. A schematic circular navigation marker indicates the spherical shape; its color is a display choice. Original inputs and all factual/configuration sources are pinned in `source/manifest.json`; the NASA GLB is restored by `source/preparation/acquisition.json`.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 1163 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 15.7710-day prograde rotation (Bernstein et al. (2023) photometric period from measurements.json; display orientation arbitrary (rotation.json)) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 20.00° initial pitch, -35.00° yaw, taken from the retired lane's camera). 

</details>
