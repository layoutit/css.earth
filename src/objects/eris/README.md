# Eris

## Sources

The surface is unresolved and is shown in the shared neutral gray (#808080 sRGB), a display convention rather than a measured colour or albedo. The Dataset panel exposes it as “Shape”; no terrain, texture or map is claimed.

The radius is 1,163 ± 6 km from the November 6, 2010 stellar occultation reported by [Sicardy et al. (2011)](https://doi.org/10.1038/nature10550). That event is consistent with a spherical body. The render sphere uses the nominal radius; it does not claim a resolved shape mesh.

## Evidence

Run of 2026-09-16 (this version): `node tools/objects/dist/prepare-authored.js eris --write` prepared the package with the neutral gray shape lens; `node --test tests/objects/unit/eris/runtime-contract.test.mts site/test/object-discovery.test.mts` passes.

The neutral surface has no nomenclature; the map edge is an arbitrary display longitude.

## Known problems

Rotation content uses the 15.771 ± 0.008-day photometric period of [Bernstein et al. (2023)](https://arxiv.org/abs/2303.13445), consistent with synchronous rotation at Dysnomia’s 15.78590-day orbital period. This supersedes the 25.9-hour value still present on NASA’s overview. The body has no measured longitude origin or established spin-pole registration. Its display pole and meridian are explicitly arbitrary, and no absolute rotational ephemeris is animated. The existing vendored JPL elements determine orbital position at the shared preparation epoch.

[Inputs](source/manifest.json) · [Preparation](source/preparation) · [Provenance](prepared/provenance.json) · [Delivered files](runtime-assets.json) · [Credits](NOTICE.md)

<details>
<summary>Methods and source notes</summary>

The neutral gray surface is generated at preparation through the raster route’s `neutral-shape` science kind; no texture is sampled.

The retained surface uses a 16 × 32 grid with prepared polar caps: 452 body quads plus one lighting quad (453 total), below the 2,000-quad budget. A schematic circular navigation marker indicates the spherical shape; its color is a display choice. Original inputs and all factual/configuration sources are pinned in `source/manifest.json`.

</details>

<details>
<summary>Shape, rotation and camera on the shared raster lane</summary>

The recipe declares a sphere of 1163 km. The retained mesh keeps its spin origin at 0°; the world frame, pole and prime meridian at the shared epoch come from `src/platform/solar-geometry.mts` as for every prepared body. The scene records a 15.7710-day prograde rotation (Bernstein et al. (2023) photometric period from measurements.json; display orientation arbitrary (rotation.json)) and 0° tilt to its orbit for the 84-second visual rotation; neither drives the physical frame. The camera is the shared solar-system camera (zoom 1.1, 20.00° initial pitch, -35.00° yaw, taken from the retired lane's camera). 

</details>
