# Saturn sources

## Body and rings

The primary implementation reference is OpenSpace's MIT-licensed
[`globe.asset`](https://github.com/OpenSpace/OpenSpace/blob/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/saturn/globe.asset).
It defines:

- Saturn's radii as 60,268 km, 60,268 km, and 54,364 km.
- Saturn's body transform as a SPICE translation and SPICE rotation.
- The principal ring texture extent as 74,500 km to 140,445 km.
- Separate radial color and transparency profiles for the lit ring system.

The associated OpenSpace
[`kernels.asset`](https://github.com/OpenSpace/OpenSpace/blob/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/saturn/kernels.asset)
loads NASA/NAIF's `sat441.bsp` Saturn kernel.

## Moons

The prepared catalog contains all 293 Saturn moons listed by JPL Solar System
Dynamics at retrieval time. `tools/acquire-moon-catalog.mjs` snapshots the JPL
[satellite discovery table](https://ssd.jpl.nasa.gov/sats/discovery.html) and
[mean satellite elements](https://ssd.jpl.nasa.gov/sats/elem/). JPL supplies
mean elements for 291 records. S/2009 S1 retains its published approximate
ring-moonlet orbit, and S/2009 S2 uses the orbit published by the Minor Planet
Center in [MPEC 2026-M19](https://minorplanetcenter.net/mpec/K26/K26M19.html).
The importer extracts only the published orbital radius from that circular.
The checked local snapshot stores normalized facts plus the MPEC URL and source
hash; no circular text is committed or redistributed. The browser does not
request or parse those authorities at runtime.

The catalog has 63 formally named moons and 230 provisional designations. The
scene currently labels the eight detailed moons only.

### Detailed moons

The retained Saturn system includes the eight bodies enumerated by OpenSpace's
MIT-licensed
[`major_moons.asset`](https://github.com/OpenSpace/OpenSpace/blob/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/saturn/major_moons.asset):
Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Hyperion, and Iapetus. Their mean
radii, semimajor axes, eccentricities, inclinations, nodes, arguments of
periapsis, mean anomalies, and periods come from JPL Solar System Dynamics'
[SAT441 physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html)
and
[mean elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html), whose declared
epoch is `2000-01-01.5 TDB`.

The browser presentation uses the same `528.027778` physical-to-visual time
scale as Saturn and its rings. Each moon follows a prepared circular mean orbit;
the source eccentricity is published in the prepared plan but is not simulated.
To keep the Saturn system legible without crowding its moons against the rings,
source semimajor axes are mapped monotonically through one declared logarithmic
presentation range from 650 to 1,200 scene pixels. Orbital order is unchanged,
but displayed separations are not physical. Body radii use a declared 1.5x
readability scale, except Titan, which uses its physical 1x proportion against
Saturn. The non-Titan moons preserve their relative sizes. These are
presentation scales, not physical-size or distance claims.

Seven moons use OpenSpace synchronized maps prepared into one lossless DPR 1/2
atlas. The checked source inputs and computed SHA-256 values are:

- Dione `dione.jpg`: `418fdc4ea2b53103350be26ee8a1569e9d9abd21be32aafaf2e801eeff495077`
- Enceladus `enceladus.jpg`: `5ba6590ca057565369bcb5e5785a3d4c0deeb9635af2e20701aa25e5d330ce31`
- Iapetus `iapetus.jpg`: `d49a3795bf5e831fb1ce040c58b66a0c81ca1a5d73badca077b24c3c8e67ec9b`
- Mimas `mimas.jpg`: `d55601e1661a9c47046a06303f308f6f32b5e53eeed69ca708ff37b6d0580ffb`
- Rhea `rhea.jpg`: `17df9b4dae4c7e40aa42f0d06e44ca4f7962817a7764e936a01395f6aa2e159f`
- Tethys `tethys.jpg`: `a0c4a0344f2361b781977e9ef9679a8cd99dd6cffacf2c1f1212a3afafa2f7d9`
- Titan `Titan_ISS_P19658_Mosaic_Global_4km_os.tif`: `5052b9f679d5e5a3e5c35c19bbac8349fcb0a6c17a8b0027b00ed8d735cc1477`

OpenSpace attributes the Titan global mosaic to USGS and NASA/PDS Cassini ISS.
Its grayscale source receives a prepared amber presentation tint. The pinned
OpenSpace Hyperion asset has physical axes and a SPICE transform but no color
layer. Hyperion therefore uses its declared axes and a prepared solid color,
not a fabricated surface map.

`tools/prepare-moons.mjs` uses one prepared camera-facing alpha plane for each
detailed moon. Seven planes contain their source maps and Hyperion contains its
declared solid color. The billboard atlas is prepared at 64 pixels per moon for DPR 1
and 128 physical pixels for DPR 2. The retained scene therefore mounts eight
moon surface leaves, plus the same seven prepared moving shadow leaves. Camera
input repositions the eight retained billboard planes. Playback performs no
geometry, texture, orbital, or stochastic preparation and makes no moon-related
JavaScript writes per playback frame.

### Minor moons

The other 285 catalog records are prepared as one circular `<b>` leaf each.
Their catalog-epoch positions use the same declared logarithmic distance model
and preserve source orbit order. Their displayed diameters have a two-physical-
pixel floor at DPR 1 and a three-physical-pixel floor at DPR 2. These dots have
no shadows, labels, wrappers, runtime orbital calculation, transform streams,
or animations. Camera input selects their shared billboard basis from a
prepared 256-frame interaction table.
They remain retained but start hidden behind the unchecked `Minor moons`
setting. The eight detailed moons remain visible under `Major moons`.
The complete moon system therefore retains 300 moon leaves and eight detailed-
moon animations.

## Background stars

The background is derived from the
[HYG Stellar Database v4.1](https://github.com/astronexus/HYG-Database),
credited to David Nash / Astronexus and licensed under CC BY-SA 4.0. The source
catalog is pinned at commit
`c7f7f883fe678cc7680169a50ccd7dcc49b060ce`; the 119,626-row CSV has SHA-256
`d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd`.

`source/stars/hyg-v41-field.json` records the selected catalog identifiers,
prepared positions, apparent magnitudes, color indices, projection, source
hash, and license. The preparation selects the 1,100 brightest stars inside a
112-degree representative field centered at right ascension 40 degrees and
declination 7 degrees. Apparent magnitude controls prepared luminance and
source-pixel radius; the catalog color index controls a restrained prepared
color temperature. The prepared subset has SHA-256
`0aec282e4c6362d498fd85452a1bb4ac11a76a67409b752c30b99f00c57fb70e`.

The field is catalog-derived but its orientation is illustrative. The Saturn
scene has no absolute observer epoch or inertial camera orientation, so the
background is not presented as the sky behind Saturn at a specific date.

The ring boundaries and the faint inner D ring are cross-checked against the
NASA PDS Ring-Moon Systems Node's
[Saturn ring statistics](https://pds-rings.seti.org/saturn/saturn_rings_table.html).
The prepared image extends through the F ring's 140,612 km outer boundary and
includes the documented D-ring ringlets at 67,580 km and 71,710 km.

## Prepared motion

The presentation uses one explicit physical-to-visual time scale. NASA's
[ring-seismology rotation result](https://science.nasa.gov/solar-system/scientists-finally-know-what-time-it-is-on-saturn/)
gives Saturn's reference interior rotation as 10 h 33 min 38 s. Mapping that to
72 visual seconds produces a `528.027778` acceleration shared by the body and
rings.
The entire presentation is intentionally accelerated by a further 1.5x from
the earlier 108-second reference; every atmospheric and ring duration uses the
same multiplier, so their physical ratios are unchanged.

NASA's [Cassini mission reference](https://science.nasa.gov/wp-content/uploads/2023/09/cassini.pdf)
gives cloud-top periods of 10 h 15 min at the equator and 23 minutes longer at
higher latitudes. Preparation maps those endpoints across the 16 retained
latitude bands with a symmetric `sin(latitude)^2` interpolation. The
interpolation is an explicit presentation model, not a claim that NASA specifies
a continuous wind law. The source periods remain recorded on their prepared
bands. The browser presentation carries every latitude on one shared 72-second
geometric phase. This keeps neighboring low-poly boundaries aligned throughout
rotation while the prepared world light remains fixed.

JPL SAT441 gives Saturn's GM as `37,931,206.23 km^3 s^-2`. Every ring group's
real circular period is prepared with `T = 2*pi*sqrt(r^3/GM)` and divided by the
same acceleration. The outer F-ring reference is therefore 101.873 visual
seconds rather than an independently chosen presentation duration.

NASA gives Saturn's obliquity as 26.73 degrees. Preparation applies that angle
once to a retained Saturn-system parent around the source X axis; the planet,
rings, shadow plane, and dust therefore share one physical spin axis. A fixed
-60-degree presentation node turns that tilted axis within the orbital plane
without changing its 26.73-degree magnitude. The independent camera sits 50
degrees above the declared orbital plane (`rotX(40deg)` in the PolyCSS camera
frame). Together they preserve a roughly 26-degree ring opening while reducing
the projected screen slant to roughly 15 degrees. This is a readable
orbital-frame presentation, not an Earth, Cassini, or date-specific ephemeris
camera.

## Texture assets

### Observation lenses

The optional ultraviolet and methane views use
[Hubble OPAL Cycle 32 Saturn global maps](https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-32)
from 2025. The acquisition script fails closed on these exact
SHA-256 values:

- F225W ultraviolet, visit A: `501c88e880a65a009fea9d86b66fe4b824abc0a07a56c0f382abe593cc08f314`
- F225W ultraviolet, visit B: `0a1e41e4f4de7bb0a026d29b303dfbcf55f902382c2e621dfd522d95881c75d3`
- FQ889N methane band, visit A: `2913da896d5e33c292d8c7a95a699cee606067b743b0bb2cab06ce51be90af53`
- FQ889N methane band, visit B: `709166ace6d89028ef8ab884323f0d886281054dac2378584f82ce2c5f90e459`

The maps are 1,800 by 900 single-band measurements. Preparation retains
rotation A intact instead of averaging temporally separated cloud detail with
rotation B. It fills only unmeasured polar and ring-occluded rows in the same
longitude and applies a declared false-color palette. A bounded prepare-time
pansharpening pass transfers only high-frequency detail from the synchronized
OpenSpace visible-light surface. Its scale is clamped to 0.88 through 1.12, so
the Hubble maps retain authority over broad spectral luminance and atmospheric
bands. Preparation writes lossless 2,880 by 1,440 and DPR-2 4,096 by 2,048
retained-globe surfaces. These views are therefore source-backed spectral
interpretations, not natural-color photographs or pure single-band products.

The Thermal view is a prepared Cassini-informed interpretation rather than a
direct global temperature retrieval. Its palette and cloud-window response are
anchored to the Cassini VIMS
[high-contrast infrared scan PIA17469](https://science.nasa.gov/photojournal/high-contrast-infrared-scan-of-saturn-and-its-rings/),
which assigns its red channel to 4.88 through 5.06 micrometers and shows heat
from Saturn's interior. Its atmospheric and ring temperature interpretation is
cross-checked against Cassini's
[Composite Infrared Spectrometer](https://science.nasa.gov/mission/cassini/spacecraft/cassini-orbiter/composite-infrared-spectrometer/).
The source observations are not one equirectangular, full-resolution map at the
scene's viewing geometry. Preparation therefore applies a declared
cloud-window and latitude response to the synchronized OpenSpace morphology.
The result preserves spatial readability without claiming per-texel measured
temperature.

The broad ring response is cross-checked against the same Hubble WFC3 program
17843 sequence from 2025-08-29: `ifcu37ccq` in F225W, `ifcu37cdq` in F631N,
and `ifcu37ceq` in FQ889N. The prepared lens textures modify broad ring-band
color and luminance while retaining the accepted OpenSpace alpha profile,
narrow gaps, ringlets, and DPR-specific readability floors. Hubble does not
resolve a complete replacement profile for the D, G, and E rings in these
frames, so those details remain qualified visible-light morphology.

- F225W ring frame `ifcu37ccq_drz.fits`: `044d23c598bb88ec2e3fc48b51dab1a80cd892e1650e18a6764f4d0fd49c7717`
- F631N ring frame `ifcu37cdq_drz.fits`: `3f769e849378fad42303a5a39e5c9fd3b004b575ffe97663ff5fb99167233dfe`
- FQ889N ring frame `ifcu37ceq_drz.fits`: `8f6c6f9d64a2406950602380d95d8593124e3712bc3df98bc7706d3b28367aad`

Every lens has prepared body, DPR-2 body, polar, ring, DPR-2 ring, exterior
material, atmospheric cutaway material, and thumbnail assets. The browser
selects prepared background sources and material variants on retained leaves.
It performs no filtering, recoloring, rasterization, source sampling, or DOM
replacement.

### Interior cutaway

The Interior view is a schematic, source-backed model. It is not a direct
observation of Saturn's interior. Its composition and terminology are checked
against the NASA/JPL-Caltech
[Saturn interior cutaway](https://science.nasa.gov/resource/saturn-interior-cutaway-illustration/).
No pixels from that illustration are redistributed.

The radial presentation follows the diffuse-core interpretation from Mankovich
and Fuller's 2021 ring-seismology result,
[A diffuse core in Saturn revealed by ring seismology](https://doi.org/10.1038/s41550-021-01448-3),
which places the stable core-envelope transition out to approximately 60
percent of Saturn's radius. The smooth transition is also cross-checked against
the CC0
[Saturn density profiles](https://doi.org/10.7291/D1P07G) from Movshovitz and
collaborators. The visible radii and colors are declared presentation choices,
not hard physical boundaries or measured natural colors.

`tools/prepare-interior.mjs` writes lossless DPR 1 and DPR 2 WebP textures for
the two section faces, the metallic-hydrogen shell, the diffuse-core shell, and
their polar caps. The cut faces occupy separate atlas tiles. Each tile receives
prepared illustrative depth shading, soft layer-contact shading, and restrained
rim light. The curved shells use prepared Lambert shading. All use the same
object-space light direction as the exterior scene. This treatment improves
legibility; it does not claim that exposed material inside Saturn receives
direct sunlight. The structural section, metallic-hydrogen, and diffuse-core
textures are one shared schematic bank because none of the observation lenses
measures below Saturn's atmosphere. Normal, F225W ultraviolet, FQ889N methane,
and Cassini-informed thermal each have prepared outer-polar and atmospheric
cutaway materials; those declared false-color responses do not recolor the
unobserved deep layers. The F225W interpretation follows NASA's
[Hubble wavelength comparison](https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/wavelengths/).
The FQ889N identification follows the
[WFC3 UVIS filter reference](https://hst-docs.stsci.edu/wfc3ihb/chapter-6-uvis-imaging-with-wfc3/6-5-uvis-spectral-elements),
and the strong 889 nm absorption is cross-checked against Simon and colleagues'
[giant-planet atmosphere review](https://ntrs.nasa.gov/citations/20220004467).
`tools/prepare-scene.mjs` converts those assets into 478
retained PolyCSS body and section leaves, including a 112.5-degree surface cut
aligned exactly to the existing 32-longitude body grid. It also prepares a
128-view cutaway material atlas for each lens, addressed through one retained
texture leaf. Each atlas uses
the same light, terminator, ring shadow, atmosphere, and foreground-ring
composition as Exterior, with only the exposed cutaway wedge removed. The
default camera state has a dedicated 1024-pixel prepared frame. Exterior and
Interior remain mounted. The browser changes one `data-view` value after the
Interior images decode, then selects a prepared material frame for the current
camera pitch. It does no geometry construction, clipping, masking, filtering,
rasterization, lighting calculation, or DOM replacement at runtime.

The body map and original 1 x 1500 ring color/transparency profiles are the
official OpenSpace synchronized `saturn_textures` version 4 resources. Their
OpenSpace asset metadata identifies the OpenSpace Team as author and MIT as the
license. The pinned license and attribution notice are included in
`LICENSE.OPENSPACE-MIT` and `NOTICE.md`.

The former accepted fixed-material checkpoint is retained only as a comparison
reference at `source/approved/saturn-fixed-material.webp`. The runtime default
frame is regenerated by the same model as the orbit bank and is never copied
from that reference. Generated staging files remain under `.prepared/`.

- [`saturn.jpg`](https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/saturn/textures/1/saturn.jpg):
  `5976d520c16f7c91a7415bdaeb1a050373a706c07adae29b38b8b5110d88acc0`
- [`color_original_single.png`](https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/saturn/textures/4/color_original_single.png):
  `952b8de4343127e2188a6fb293d499e3e8b7c19147f5a2d727c525f8e9bcebda`
- [`trans_original_single.png`](https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/saturn/saturn/textures/4/trans_original_single.png):
  `37a40a8217961cda634a3fe48775072f5097b40d8945cfaf82bdfb58b98caf2a`

OpenSpace provides no separate resolved polar color layer: its default Saturn
color layer is the same single `saturn.jpg`. The north-polar surface therefore
uses NASA Cassini product
[`PIA21611`](https://science.nasa.gov/photojournal/saturns-hexagon-as-summer-solstice-approaches/),
credited to NASA/JPL-Caltech/Space Science Institute/Hampton University. The
downloaded 2,048 x 1,024 JPEG contains the 2013 and 2017 natural-color maps side
by side; preparation selects the 1,024 x 1,024 2017 map. NASA documents the
product as a north-polar stereographic projection at approximately 25 km per
pixel, assembled from Cassini ISS wide-angle red, green, and blue observations.
The pinned input is `source/cassini-pia21611.jpg`, SHA-256
`2e9765b2ffada33d74bfbe0443ea0bbf59bb15f27a128b7ba99160fdeb78f177`.
It is retained with the source's full credit under the
[NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
and [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/).

`tools/prepare-assets.mjs` converts the source radial profiles into a
2,048 x 2,048 lossless transparent radial WebP plus a 4,096 x 4,096 DPR-2
variant. The 137.383 km DPR-1 prepared radial
pitch preserves the broad source density structure and gives the 4,550 km
Cassini Division 33.12 radial pixels. Preparation also constrains the published
PDS boundaries for the Cassini and Roche divisions, Encke and Keeler gaps, and
the F ring; its 140,224 km core uses the PDS optical-depth range rather than a
painted arbitrary line. PDS describes the tenuous D ring as containing narrow
ringlets at 67,580 km and 71,710 km. Those source radii and their existing
105 km prepared footprint remain unchanged; only their opacity receives a
declared presentation lift. Across the complete C-ring source interval from
74,500 km to 91,975 km, preparation remaps source alpha with
`1 - (1 - alpha)^2.25`. This makes every existing fine radial feature survive
the oblique browser projection without widening it or filling its gaps. These
are explicitly prepared opacity emphases, not physical optical-depth claims.
At DPR 2, an offline local-extrema pass gives each salient one-pixel bright
ringlet and dark gap a two-CSS-pixel minimum footprint. It copies the prepared
radial sample into the less destructive adjacent radial cell and applies the
same rule to light and dark extrema; this avoids the maximum-only dilation that
would erase narrow gaps. The Saturn client mounts the canonical DPR 2 lossless
plate directly, independent of device DPR. Decode warmup uses that one bank
when the client module starts; it has no density listener and never replaces
the mounted scene. The DPR-1 profile, source radii, broad band widths, shadow
sampling profile, and ring-plane geometry are unchanged, and the browser does
no per-frame DPR work or raster work. Keeler remains source-limited, so this is
improved prepared readability rather than a claim that every narrow ringlet is
physically resolved. It prepares 200 deterministic main-ring motion candidates.
The 190 visible C-, B-, and A-ring accents are rasterized into four rotating
DPR-specific plates. The 10 imperceptible F-ring candidates are omitted instead
of adding retained leaves or another large transparent compositor surface. The
OpenSpace ring RGB profile receives the same `#fff1ea`
linear-light solar chromatic multiplication as the planet surface. Its band/gap
morphology and relative brightness ordering remain unchanged outside the
declared inner opacity presentation; the motion accents target the same warm
solar white instead of neutral white. The G-ring, Janus-Epimetheus, and E-ring
dust candidates are not published. Their detached presentation competed with
the moon field and did not read as part of the main ring system. The browser
mounts only the four prepared C-, B-, and A-ring motion plates and no HTML dust
points.
This preparation is offline: the browser does no source-image
sampling, stochastic particle generation, orbital math, or asset raster
generation.

The same preparation writes one deterministic 2,560 x 1,440 lossless WebP for
the static catalog-derived star field. It is mounted as the stage's single
background image; there are no star elements, gradients, runtime generation,
or background animation. The generated `saturn-starfield.webp` is 6,786 bytes
with SHA-256
`ac41b07d52d57b8a1ce87d00471a05264066b12272f3eaf3da2d6e1cd00454ce`.
The generated `saturn-rings.webp` is 336,204 bytes with SHA-256
`6cd35412b4a9374c66f0fdc0a84d64f2ff79bbb7be927fb1215b99f6cc44ac1f`.
The selected-only `saturn-rings@2x.webp` is 819,624 bytes with SHA-256
`4a3ee243eb308ed353b173b94d0ab58b56ed7e12ae6141988f65d662aeb95d3c`.

PolyCSS projects the oblate polygon globe and the single textured ring plane
during offline preparation. The browser mounts the resulting retained leaf
transforms, following the same prepared-plan boundary used by the CSS Mario
adapter. `tools/prepare-scene.mjs` maps the official 2,880 x 1,440 OpenSpace
equirectangular image directly onto the retained longitude-latitude grid. The
byte-identical source is retained as `source/saturn-surface-original.jpg`.
Preparation applies the declared solar color to it in linear light and writes
the continuous derived `saturn-surface.jpg`. The retained projective leaves use
`saturn-surface-body.jpg`, which reverses the rows inside each 90-pixel latitude
strip because the direct projective image leaf maps its first polygon edge to
the top of the source rectangle. This makes adjacent retained bands meet on
adjacent north/south source texels. It changes no geometry and performs no
runtime filtering. Each 90 x 90 UV source cell is sampled by a 64 x 64 PolyCSS
raster leaf, giving the textured bands a 2,048 x 896 prepared paint density.

The polar regions are projected offline into the lossless 4,096 x 512
`saturn-poles.webp` atlas instead of being represented by solid triangle fans.
The north disc inversely maps each prepared sample into PIA21611's declared
25 km-per-pixel stereographic projection using OpenSpace's 60,268 km
equatorial radius. The outer six percent of the disc uses a smooth prepared
transition to the OpenSpace map after matching the three mean boundary
channels; this removes the source-product edge without hiding the hexagon or
adding a runtime blend. The south disc remains sourced from OpenSpace's
equirectangular map. The atlas contains separate 512 x 512 north/south albedo
and fixed-world material tiles for both visible polar discs and two larger caps
inset behind their boundaries. The inset tiles clamp their outer samples to the
visible caps' exact source and material boundary, so they close subpixel raster
gaps without stretching different texels through the seam. These eight
prepared tiles mount as four rotating source leaves and four fixed-world
material leaves; they add no browser-side sampling, lighting math, matrix
formatting, or DOM reconstruction. The generated polar atlas is 34,906 bytes
and its SHA-256 is
`9a7b647c4b31c8a8f9d25f20f33a1fdf70f2c02c8448c5bf0769cd7e9739a21c`.

The separate material overlays start from the pinned OpenSpace
`RenderableGlobe` illumination model. OpenSpace uses the Sun scene node when no
other light source is declared, a neutral RGB albedo multiplier, a `0.05`
ambient intensity, and Oren-Nayar roughness `0` (Lambert). This adapter replaces
OpenSpace's neutral multiplier with a prepared warm solar presentation. NASA's
[Sun fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html)
gives the solar photosphere an effective temperature of 5,772 K. The prepared
`#fff1ea` multiplier is derived from a 5,772 K Planck distribution through the
CIE 1931 observer and linear sRGB/D65, normalized by its maximum channel. This
is a declared colorimetric display approximation, not flat white light or a
full spectral renderer. The constant solar spectrum is multiplied into the
surface texels once during preparation. OpenSpace's globe shader multiplies the
Lambert term by `smoothstep(0, 0.1, N dot L)` to soften the terminator.
Preparation applies that same source model to continuous per-texel oblate
normals. The prepared material solves black-alpha intensity attenuation against
the declared sRGB reference channel `160`, then source-over composites the
prepared pearl-blue atmospheric response into that same texel. The pinned
geometry authority is OpenSpace
[`renderableglobe.cpp`](https://github.com/OpenSpace/OpenSpace/blob/56e29b54b8592084ff1fef47c2e08de0b22ce516/modules/globebrowsing/src/renderableglobe.cpp)
and
[`texturetilemapping.glsl`](https://github.com/OpenSpace/OpenSpace/blob/56e29b54b8592084ff1fef47c2e08de0b22ce516/modules/globebrowsing/shaders/texturetilemapping.glsl).
The 5,188 x 4,160 `saturn-orbit-material.webp` RGBA preparation master packs
256 prepared camera-elevation material fields in a 16 x 16 grid. Each field has
a 256-pixel tile and a two-pixel gutter. Runtime export retains one active
variant atlas and one generated high-resolution default frame. The four lenses
each have full, no-shadow, and ringless exterior and cutaway masters, so the
controls remove only the requested phenomena without removing Saturn's
lighting. The browser selects one prepared address only when camera input
changes. It performs no lighting playback while the scene is idle. The material
stores the pearl-blue, view- and
light-dependent limb response from prepared oblate normal samples over the solar
attenuation. CSS therefore paints one material background over the surface
instead of separate atmosphere and shadow layers. The nine 32 x 32 storm
targets sample one checked 290 x 34 static weather snapshot. These illustrative
visible-color storm overlays are intentionally absent from the observation
lenses, which use their source-backed spectral body maps. The snapshot is
`source/saturn-weather-static.webp`, SHA-256
`04a8df6aa490a2d769b6f579a29d16f78e3c58427438daa6114b3a6ebfbe30b3`.
It is the accepted three-storm texel result prepared from the declared
OpenSpace Saturn surface and the three storm kernels recorded in the scene
preparer. It is explicitly qualified as an adapter-owned artistic presentation,
not scientific storm data. `node src/planets/saturn/tools/prepare-weather-source.mjs` validates its declared
source hash and dimensions, then copies the encoded bytes to the runtime path
without re-encoding. No previous animation sequence, screenshot, rendered
capture, or hand-authored scientific curve is required.
No pseudo-element, custom property, blend mode, filter, or extra DOM leaf is
used. The selected material address and prepared plane transform are published
together on an input frame. The address stays fixed between inputs while CSS
animations rotate the albedo geometry underneath it. No registered or animated
CSS custom property participates. The browser performs no lighting equation,
texture sampling, raster generation, or DOM reconstruction.

The 32 x 16 globe topology uses 448 textured body faces between two prepared
polar regions. The continuous prepared material field and the 0.8% presentation
overlap are mapped together, so adjacent faces sample the same lighting field
through their shared boundary rather than revealing independently angled band
cells.

Preparation transforms the fixed world-light vector through the inverse node,
inverse 26.73-degree system tilt, and inverse initial body phase before baking
the lighting cycle and mutual shadows. The browser therefore mounts one static
tilt parent while the existing prepared child rotations remain pure spin about
Saturn's tilted axis; no per-frame matrix composition is required.

The same prepared world-light vector drives two reciprocal static shadows.
For Saturn's shadow on the rings, preparation casts four subpixel rays per
ring texel against Saturn's source-radius oblate ellipsoid. The unshadowed ring
material remains intact. Occlusion is emitted as the separate lossless
`saturn-ring-shadow.webp` alpha overlay, with a squared source-alpha term and a
smooth dense-ring ramp. That keeps the overlay on optically readable ring
bands instead of turning faint ring gaps into an opaque connector. The overlay
is one fixed retained PolyCSS leaf on the ring plane while the axisymmetric
ring material rotates beneath it; the full-coverage transmission floor is
`0.16`. For the rings' shadow on Saturn,
preparation casts each body texel toward that light, intersects the ring plane,
and bilinearly samples the actual prepared radial ring alpha. This retains the
source ring gaps and density bands instead of inventing a uniform dark stripe.
The two observed phenomena are cross-checked against NASA's
[Saturn shadow on the rings](https://science.nasa.gov/photojournal/saturns-shadow-upon-the-rings/)
and [ring shadows on Saturn](https://science.nasa.gov/photojournal/rings-and-shadows/)
references. These are one prepared presentation state, not a date-specific
ephemeris or a runtime world-space shadow simulation. The browser mounts the
prepared shadow leaf but performs no shadow sampling or lighting work.

Each textured latitude owns one complete retained 32-leaf set. All source
longitudes remain mounted through every band rotation and browser backface
visibility remains the presentation cull. The browser does no lighting math,
image generation, blend-mode filtering, geometry planning, allocation-driven
preparation, or DOM reconstruction. Camera input selects one prepared material
address from the single active decoded variant atlas. The four main-ring motion
accents use
lossless transparent PolyCSS texture leaves bound directly to their canonical
DPR 2 plates. The scene has no outer-dust plate, density expansion bank, or
per-point runtime work.

The prepared `saturn-surface.jpg` SHA-256 is
`6f993757845ac59a3a2186ad72e979590a80985da15fa1b6e9eed9ce9924a994`.
The projective-leaf-oriented `saturn-surface-body.jpg` SHA-256 is
`63962834479ae719c9603bdb0788b4058f4df458420b280c7e1eb99c595f9b51`.
The current preparation and runtime asset manifests record the generated orbit
material masters, verification shards, generated default frame, byte lengths,
and SHA-256 digests. The former approved checkpoint is recorded only as a
comparison reference and is not a runtime asset.
The prepared ring-shadow overlay SHA-256 is
`243c2867c4ede6c638a1134eb54c36312e256df81fc081489dc99bd1bdad2943`.

The low-poly globe uses a 32 x 16 UV grid (448 textured body polygons plus
prepared polar leaves) and PolyCSS seam
bleed `0.25`. No hidden inner fill is mounted. A 0.8% prepared surface overlap
closes transform-raster cracks at shared Saturn edges. The single transparent
ring quad has no adjacent polygon seam to bleed. The camera is interactive.
Sixteen retained latitude-band meshes rotate around their shared prepared axis
on one 72-second geometric phase. The prepared ring-point groups orbit in the
same prograde direction. Continuous geometry motion is owned by prepared CSS
keyframes. Lighting remains fixed between camera inputs, and node identity stays
stable.

The four main-ring motion plates preserve separate source-band orbital periods.
Their CSS orbit durations use the SAT441 GM and circular-orbit equation under
the shared `528.027778` acceleration. No per-point runtime calculation, style
write, or density-expansion animation occurs.

## Prepared atmospheric charts

The sidebar spectrum is a prepared 253-sample NASA Goddard Planetary Spectrum
Generator model of Saturn's disk reflectance. It covers 0.35 to 1.0 micrometers
at resolving power R=240 and reports I/F apparent albedo. The checked expanded
request is `source/atmosphere/psg-saturn-20260829.cfg`, SHA-256
`93165938d49f7682b5b9bf9b23537a1ed3a0c3f91fc6cec4f4af9e2274d9682e`.
The raw NASA ASCII response is
`source/atmosphere/psg-saturn-r240-rif.txt`, SHA-256
`7908cd301b19cbeba2e08a29457f621296860b29ea5f021dea4dea2041fbf1b6`.
It was acquired with `OBJECT-DATE=2026/08/29 12:00`, `OBJECT-NAME=Saturn`,
`type=cfg`, `wephm=y`, and `watm=y`. The resulting expanded configuration was
submitted with `type=rad`, `wephm=n`, and `watm=n`. The checked request can be
revalidated with `node src/planets/saturn/tools/acquire-atmosphere-spectrum.mjs --refresh`. Preparation uses only
the local raw response through `node src/planets/saturn/tools/prepare-atmosphere-spectrum.mjs`. It parses all 253
numeric rows and generates the local SVG without reading an earlier SVG. The
browser performs no NASA request or spectral calculation at runtime.

The same preparation command reads the checked 60-layer pressure-temperature
profile from the expanded PSG configuration and generates a separate local
temperature-pressure SVG. It preserves the full 10 bar to 2 nanobar range on a
logarithmic pressure axis, with high pressure at the bottom. The browser performs
no atmospheric-layer parsing, scaling, or chart rendering at runtime.

Source: [NASA GSFC Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/)
and its [API](https://psg.gsfc.nasa.gov/helpapi.php), modeled 2026-08-29.
