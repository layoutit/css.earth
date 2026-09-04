# Earth source record

Earth is prepared from checked, adapter-owned source snapshots. Runtime code reads only files in `/scenes/earth/` and the generated Earth modules. It does not contact any source service.

## Surface and observation layers

- Normal colour: NASA Earth Observatory, Blue Marble Next Generation, December 2004. The checked 21,600 × 10,800 JPEG is `source/blue-marble-december.jpg`.
- Topography: NASA Earth Observatory, Blue Marble topography and bathymetry, December 2004. The checked 21,600 × 10,800 JPEG is `source/blue-marble-topography.jpg`.
- Clouds: NASA Visible Earth, Blue Marble Clouds. The checked 8,192 × 4,096 TIFF is `source/blue-marble-clouds.tif`.
- Night lights: NASA Earth Observatory, Black Marble 2016. The checked global 3 km, 13,500 × 6,750 JPEG is `source/black-marble-2016.jpg`.
- Navigation marker: NASA image-library Earth globe `GSFC_20171208_Archive_e001016`, checked as `source/earth-navigation.jpg`.

The OpenSpace Earth asset configuration at commit `56e29b54b8592084ff1fef47c2e08de0b22ce516` is checked beside the image sources. It proves the upstream Earth interpretation; the Earth adapter does not fetch OpenSpace assets at runtime.

## Prepared visual atmosphere

`source/openspace/earth-atmosphere.asset` is also the numerical authority for
the visible atmosphere. Preparation parses its 6,377 km planet radius, 70 km
atmosphere height, 680/550/440 nm Rayleigh scattering coefficients, 8 km
Rayleigh scale height, and Mie coefficients, scale height, and anisotropy.
Those values produce the static view bank and its exact outer-radius ratio.
Google Earth Pro supplies only the presentation operator layered over those
Earth facts: a captured Sun-direction uniform, 0.2 camera exposure,
exponential tone mapping, and luminance-driven opacity. Earth irradiance,
twilight width, limb concentration, colour, and density remain body-specific
and are derived from the OpenSpace atmosphere values. The checked
`source/atmosphere/google-earth-pro-presentation-response.json` records the
linked-shader hashes and successful headless layer-isolation gates. It does not
redistribute Google pixels or shader bytes. Google Earth Pro's blue Mars result
is deliberately not treated as a body-colour authority.
The browser mounts the canonical prepared DPR 2 bank, independent of device
DPR; it performs no scattering, geometry, or raster work at runtime.

The three exterior lenses use one DPR-independent canonical surface and pole
atlas each. Each surface is prepared at 8,192 × 4,096, packed through the
existing 16-band projective raster with a 64-pixel physical gutter into an
8,320 × 6,144 WebP at quality 84. Its logical presentation remains
2,080 × 1,536 with a 16-pixel gutter, seam bleed 0, and the existing compositor
overlap. The prepared raster overscan is exactly 0.512 logical pixels: the
64-pixel presentation cell multiplied by the existing 0.008 compositor
overlap. This keeps the texture sample aligned with the already-expanded leaf
without changing its matrix or source rectangle. Each matching pole atlas is
2,048 × 512. The atlas density changes; the retained leaves, source rectangles,
geometry, and projective address function do not. The normal, topography, and night-light inputs all contain enough checked
source detail for this preparation; the night input is the official NASA
13,500 × 6,750 global file, not an upscale of the former 3,600 × 1,800 source.
The camera maximum is 8 and there is no LOD or runtime raster path.

Atmosphere and lighting assets retain their existing prepared pairs. Runtime
addresses their canonical high-density assets. Earth lighting and
atmosphere motion use 32 prepared four-frame shards for each density. Every
shard is a 2 by 2 square: 1,016 by 1,016 at logical density and 2,032 by 2,032
for the canonical high-density asset. Runtime retains at most three decoded
shards per material. Camera and material projection transforms are prepared
keyframes transported through paused Web Animations; runtime changes only
animation time, image addresses, and the camera scale.

The cross-section remains a source-backed schematic, not a claim about a
physically tilted interior. At near-pole-on camera angles, one prepared
presentation-only orbit reveals the section faces without changing Earth's
23.4 degree axial-tilt fact. The cutaway is decoded and mounted only after the
user selects it, then retained for the remainder of the mount.

## Atmosphere charts

`source/atmosphere/psg-earth-20260830.cfg` is the expanded NASA GSFC Planetary Spectrum Generator configuration for Earth at 2026-08-30 12:00, followed by the declared 0.35–1.0 µm, R=120, I/F generator block. PSG prepends a human-readable MERRA retrieval warning to this Earth response. That warning is not a PSG configuration record and makes a subsequent radiance request return an empty body. Earth acquisition removes exactly that leading warning line before pinning and resubmitting the configuration. The complete numerical atmosphere remains unchanged.

`source/atmosphere/psg-earth-r120-rif.txt` is the checked PSG radiance response. Its full numerical output is unchanged. Only the synthesis-clock and execution-time comment lines are normalized so the same pinned response can be restored deterministically. Preparation converts the complete sample set and the configuration's ordered pressure/temperature layers to static SVG charts.

## Moon facts and star presentation

The checked JPL Solar System Dynamics physical-parameter and mean-element pages provide the Moon's radius, density, mean orbital distance, inclination, period, and Earth GM. `source/moon/earth-moon.json` is a generated normalization that records those values and both authority hashes.

The Moon is a separate object package and route. Earth keeps only the checked
relationship facts used by its information panel; the Earth scene does not
prepare, mount, animate, toggle, or request a Moon representation.

The starfield is a presentation layer prepared from HYG Database v4.1 at commit `c7f7f883fe678cc7680169a50ccd7dcc49b060ce`. It is not a view tied to the Earth observation epoch. Preparation deterministically selects the brightest finite entries and rasterizes them to a static background.

## Editorial and interior

`data/planets/earth.json` is prepared from NASA Science record 48583, `Facts About Earth`. NASA's block-feed endpoint currently fails server-side for this record. Earth acquisition therefore validates the canonical WordPress record and parses the same selected headings from its checked `content.rendered` field. The shared editorial tool and contract are unchanged.

`source/interior/earth-interior.json` is an adapter-owned presentation specification based on the layer radii and descriptions in the checked NASA Science editorial snapshot. It is explicitly schematic; it is not a seismic tomography product.

## Typography

The Earth heading outline is extracted at preparation time from Inter Variable 4.001, commit `9221beed3`, weight 500, optical size 28. The checked font and exact outline source are declared in the source manifest. Runtime does not load a planet-specific font.

## Reproduction

Run:

```sh
node src/planets/earth/tools/acquire.mjs
node src/planets/earth/tools/prepare.mjs
node src/planets/earth/tools/acquire.mjs --verify-only
```

`--refresh` is explicit and fail-closed: every refreshed authority must match the committed byte size and SHA-256 before publication.
