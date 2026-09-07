# Miranda

The Monochrome lens uses the [NASA/JPL Solar System Simulator map](https://space.jpl.nasa.gov/tmaps/uranus.html), a USGS mosaic of Voyager imagery (`ura5vuu2.tif`). The pinned 1440 × 720, 8-bit monochrome TIFF contains four pixels per degree. The app preserves that native density; a larger pole atlas does not add observed detail. No elevation or color dataset is implied.

The map is interpreted as simple cylindrical, north at the top, −180° to +180° east-positive longitude. The TIFF lacks georeferencing tags. This interpretation is independently checked visually against the [USGS Gazetteer](https://planetarynames.wr.usgs.gov/SearchResults?Target=98_Miranda): Elsinore (257.1° E, 24.8° S), Arden (73.7° E, 29.1° S), and Inverness (325.7° E, 66.9° S). Preparation rolls longitude into the shared 0–360° surface layout without mirroring. This is display registration, not new geodetic control.

Exact black connected to the northern border is unavailable coverage. A longitude-wrapped flood fill creates validity before interpolation; isolated black photographic terrain stays valid. Gray grid marks unavailable coverage. No missing hemisphere is synthesized, mirrored, or borrowed. The standard spherical mesh has the vendored mean radius of 235.7 km; photographed scarps are texture detail, not measured 3D relief.

The mosaic retains local cast shadows, illumination variation, and seams from its observations. The distribution contains neither calibrated frames nor per-frame incidence/emission geometry, so no unsupported inverse-lighting correction is applied. Both shared flood curvature and optional directional Shadows remain enabled. JPL describes this family of maps as display products unsuitable for scientific analysis; do not interpret pixel brightness as calibrated reflectance.

The [PIA01490 south-polar press mosaic](https://science.nasa.gov/photojournal/south-polar-view-of-miranda/) was inspected as a higher-resolution candidate. Its displayed disc has no accompanying usable projection/camera registration. It is excluded from the surface rather than stretched onto coordinates it does not establish.

Physical/orbital values come from the vendored astronomy package: JPL satellite elements, body radius and IAU/NAIF rotation at the shared epoch. The default camera faces observed southern terrain (315° E, 60° S). [NASA's overview](https://science.nasa.gov/uranus/moons/miranda/) supplies editorial facts. No atmospheric shell is supported.

The generic solid-observation recipe prepares surface/pole atlases, flood/directional lighting, a small minimap, thumbnails, and a purpose-sized marker from observed terrain. The marker is an illustrative terrain crop with shared curvature, not a newly observed full disc. No body-specific controller is added.

Restore sources with `node tools/objects/dist/operations.js acquire miranda`; verify with `pnpm acquire:planets -- --verify-only --object=miranda`. Prepare with `node tools/objects/dist/prepare-authored.js miranda --write`, then shared navigation/world context. Runtime-only installation is `pnpm setup:assets --object=miranda` and does not require source TIFFs.
