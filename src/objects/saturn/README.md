# Saturn sources

Saturn combines OpenSpace and Cassini visible imagery, Hubble spectral maps,
a ring model, schematic thermal and interior views, and modeled atmosphere charts.

## Sources

| View or quantity | Source |
| --- | --- |
| Visible body and ring profiles | Pinned OpenSpace assets and [Cassini PIA21611](https://science.nasa.gov/photojournal/saturns-hexagon-as-summer-solstice-approaches/) |
| Ultraviolet and methane bands | [Hubble OPAL Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-32), 2025 |
| Ring boundaries and motion | [PDS ring statistics](https://pds-rings.seti.org/saturn/saturn_rings_table.html) and JPL SAT441 |
| Interior | [Mankovich and Fuller (2021)](https://doi.org/10.1038/s41550-021-01448-3) and [Movshovitz density profiles](https://doi.org/10.7291/D1P07G) |
| Atmosphere charts | [NASA Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/), modeled 29 August 2026 |

## Evidence

The record describes source cross-checks and retains a fixed-material comparison
image. It cites no dated test or browser run. The comparison image is not an
input to the runtime view.

## Known problems

- Ultraviolet and methane views contain filled rows and added visible-light detail; they are not pure single-band observations.
- Thermal colors, interior layers and storms are illustrations. No measured global thermal raster is qualified here.
- Ring opacity and narrow features are enhanced for readability; they do not establish optical depth or fully resolved ringlets.
- Rotation is accelerated. The camera, shadows and background orientation are presentation choices, and source observations come from different dates.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

The recipe binds Saturn's settings to the shared
[material-composition preparer](../../../tools/objects/material-composition/index.mts),
which uses the shared radial, cutaway, sky and content preparation modules.

<details>
<summary>Dimensions, motion and navigation portrait</summary>

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

## Prepared motion

The presentation uses one explicit physical-to-visual time scale. NASA's
[ring-seismology rotation result](https://science.nasa.gov/solar-system/scientists-finally-know-what-time-it-is-on-saturn/)
gives Saturn's reference interior rotation as 10 h 33 min 38 s. Mapping that to
72 visual seconds produces a `528.027778` acceleration shared by the body and
rings.

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
rings and shadow plane therefore share one physical spin axis. A fixed
-60-degree presentation node turns that tilted axis within the orbital plane
without changing its 26.73-degree magnitude. The independent camera sits 50
degrees above the declared orbital plane (`rotX(40deg)` in the PolyCSS camera
frame). Together they preserve a roughly 26-degree ring opening while reducing
the projected screen slant to roughly 15 degrees. This is a readable
orbital-frame presentation, not an Earth, Cassini, or date-specific ephemeris
camera.

## Context billboard

The navigation portrait crops the pinned OpenSpace surface map. Because this is a flat map rather than an already-lit disc photograph, the shared marker preparer applies full-phase curvature inside its existing oblate ellipse (35% ambient, 65% diffuse). The centre retains the map brightness and the limb darkens symmetrically; no directional terminator or new surface detail is added. Both the small navigation atlas and the resolved Saturn context image use this same authored recipe.

</details>

<details>
<summary>Visible color, polar imagery and source pins</summary>

## Texture assets

The body map and original 1 x 1500 ring color/transparency profiles are the
official OpenSpace synchronized `saturn_textures` version 4 resources. Their
OpenSpace asset metadata identifies the OpenSpace Team as author and MIT as the
license. The pinned license and attribution notice are included in
`LICENSE.OPENSPACE-MIT` and `NOTICE.md`.

`source/approved/saturn-fixed-material.webp` is a comparison reference. The
default frame is regenerated by the same model as the orbit bank; the reference
is not a source of runtime pixels.

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

</details>

<details>
<summary>Ultraviolet, methane and thermal interpretation</summary>

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

The **Thermal illustration** is explicitly schematic. Preparation uses visible
luminance, cloud-window contrast, and authored latitude/longitude patterns.
No Cassini detector samples or measured global thermal raster enter this view;
its color is illustrative intensity, not infrared brightness or temperature.
The visible label and legend identify this distinction without requiring a
source-document or tooltip lookup.

The Cassini VIMS [high-contrast infrared scan PIA17468](https://science.nasa.gov/resource/high-contrast-infrared-scan-of-saturn-and-its-rings/)
was considered as a physical reference. It is a narrow observed swath in a
particular viewing geometry, not a registered global thermal map suitable for
this globe. It remains a reference, not a texture input. The existing sources
do not qualify a global CIRS temperature map; such a dataset remains unresolved
rather than being claimed nonexistent.

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

Every lens has prepared body, polar, ring, exterior material, atmospheric
cutaway material and thumbnail assets.

</details>

<details>
<summary>Schematic interior and cutaway method</summary>

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

The shared cutaway preparer writes lossless DPR 1 and DPR 2 WebP textures for
the two section faces, the metallic-hydrogen shell, the diffuse-core shell, and
their polar caps. The cut faces occupy separate atlas tiles. Each tile receives
prepared illustrative depth shading, soft layer-contact shading, and restrained
rim light. The curved shells use prepared Lambert shading. All use the same
object-space light direction as the exterior scene. This treatment improves
legibility; it does not claim that exposed material inside Saturn receives
direct sunlight. The structural section, metallic-hydrogen, and diffuse-core
textures are one shared schematic bank because none of the observation lenses
measures below Saturn's atmosphere. Normal, F225W ultraviolet, FQ889N methane,
and the schematic thermal illustration each have prepared outer-polar and atmospheric
cutaway materials; those declared false-color responses do not recolor the
unobserved deep layers. The F225W interpretation follows NASA's
[Hubble wavelength comparison](https://science.nasa.gov/mission/hubble/science/science-behind-the-discoveries/wavelengths/).
The FQ889N identification follows the
[WFC3 UVIS filter reference](https://hst-docs.stsci.edu/wfc3ihb/chapter-6-uvis-imaging-with-wfc3/6-5-uvis-spectral-elements),
and the strong 889 nm absorption is cross-checked against Simon and colleagues'
[giant-planet atmosphere review](https://ntrs.nasa.gov/citations/20220004467).
Preparation aligns the 112.5-degree surface cut to the 32-longitude body grid.
Its 128-view cutaway material atlas uses the exterior light, terminator, ring
shadow, atmosphere and foreground-ring composition with the wedge removed.
The default camera state has a dedicated 1,024-pixel prepared frame.

</details>

<details>
<summary>Ring profile, opacity and readability adjustments</summary>

The shared radial-layer preparer converts the source profiles into a
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
would erase narrow gaps. The canonical DPR 2 plate is selected independently of device DPR. Source radii,
broad band widths, shadow sampling and ring-plane geometry remain unchanged.
Keeler remains source-limited, so this is
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
dust candidates are not published. The four C-, B-, and A-ring plates provide the displayed motion.

</details>

<details>
<summary>Surface and polar map projection</summary>

The shared material-composition preparer projects the oblate globe and ring
plane. It maps the official 2,880 x 1,440 OpenSpace
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
gaps without stretching different texels through the seam. These form eight
prepared tiles: source and fixed-world material tiles for
the visible and inset caps.

</details>

<details>
<summary>Prepared lighting, storm illustration and mutual shadows</summary>

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
not scientific storm data. Preparation validates the snapshot's hash and
dimensions, then copies its encoded bytes without re-encoding.

The 32 x 16 globe topology uses 448 textured body faces between two prepared
polar regions. The continuous prepared material field and the 0.8% presentation
overlap are mapped together, so adjacent faces sample the same lighting field
through their shared boundary rather than revealing independently angled band
cells.

Preparation transforms the fixed world-light vector through the inverse node,
inverse 26.73-degree system tilt, and inverse initial body phase before baking
the lighting cycle and mutual shadows. The resulting light stays fixed while the body rotates about Saturn's tilted
axis.

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
ephemeris or a changing physical shadow simulation.

Generated asset dimensions, byte lengths and hashes belong in the prepared and
runtime asset manifests. The comparison checkpoint remains outside the runtime
asset set.

The low-poly globe uses a 32 x 16 UV grid (448 textured body polygons plus
prepared polar leaves) and PolyCSS seam
bleed `0.25`. No hidden inner fill is mounted. A 0.8% prepared surface overlap
closes transform-raster cracks at shared Saturn edges. The single transparent
ring quad has no adjacent polygon seam to bleed. The camera is interactive.
Sixteen retained latitude-band meshes rotate around their shared prepared axis
on one 72-second geometric phase. The ring motion plates orbit in the same prograde direction. Lighting remains
fixed between camera inputs.

The four main-ring plates preserve separate source-band periods under the
SAT441 circular-orbit equation and shared `528.027778` acceleration.

</details>

<details>
<summary>Modeled atmosphere charts</summary>

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
submitted with `type=rad`, `wephm=n`, and `watm=n`. The shared acquisition plan
records both requests. The shared content preparer reads all 253 numeric rows
from the retained response to generate the chart.

The temperature-pressure chart reads the checked 60-layer profile from the
expanded PSG configuration. It preserves the full 10 bar to 2 nanobar range
on a logarithmic pressure axis, with high pressure at the bottom.

Source: [NASA GSFC Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/)
and its [API](https://psg.gsfc.nasa.gov/helpapi.php), modeled 2026-08-29.

</details>

<details>
<summary>Retained satellite catalog and image archive</summary>

## Moons

The retained catalog records the 293 Saturn moons listed by JPL Solar System
Dynamics on 2026-08-29. The shared acquisition plan snapshots the JPL
[satellite discovery table](https://ssd.jpl.nasa.gov/sats/discovery.html) and
[mean satellite elements](https://ssd.jpl.nasa.gov/sats/elem/). JPL supplies
mean elements for 291 records. S/2009 S1 retains its published approximate
ring-moonlet orbit, and S/2009 S2 uses the orbit published by the Minor Planet
Center in [MPEC 2026-M19](https://minorplanetcenter.net/mpec/K26/K26M19.html).
The importer extracts only the published orbital radius from that circular.
The checked local snapshot stores normalized facts plus the MPEC URL and source
hash; no circular text is committed or redistributed. The browser does not
request or parse those authorities at runtime.

The catalog has 63 formally named moons and 230 provisional designations.
These are retained source records. Moons have separate object packages and are
not rendered as embedded bodies in Saturn's current recipe.

### Detailed moons

The source archive includes the eight bodies enumerated by OpenSpace's
MIT-licensed
[`major_moons.asset`](https://github.com/OpenSpace/OpenSpace/blob/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/saturn/major_moons.asset):
Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Hyperion, and Iapetus. Their mean
radii, semimajor axes, eccentricities, inclinations, nodes, arguments of
periapsis, mean anomalies, and periods come from JPL Solar System Dynamics'
[SAT441 physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html)
and
[mean elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html), whose declared
epoch is `2000-01-01.5 TDB`.

The archive retains seven OpenSpace synchronized maps. Their checked inputs
and SHA-256 values are:

- Dione `dione.jpg`: `418fdc4ea2b53103350be26ee8a1569e9d9abd21be32aafaf2e801eeff495077`
- Enceladus `enceladus.jpg`: `5ba6590ca057565369bcb5e5785a3d4c0deeb9635af2e20701aa25e5d330ce31`
- Iapetus `iapetus.jpg`: `d49a3795bf5e831fb1ce040c58b66a0c81ca1a5d73badca077b24c3c8e67ec9b`
- Mimas `mimas.jpg`: `d55601e1661a9c47046a06303f308f6f32b5e53eeed69ca708ff37b6d0580ffb`
- Rhea `rhea.jpg`: `17df9b4dae4c7e40aa42f0d06e44ca4f7962817a7764e936a01395f6aa2e159f`
- Tethys `tethys.jpg`: `a0c4a0344f2361b781977e9ef9679a8cd99dd6cffacf2c1f1212a3afafa2f7d9`
- Titan `Titan_ISS_P19658_Mosaic_Global_4km_os.tif`: `5052b9f679d5e5a3e5c35c19bbac8349fcb0a6c17a8b0027b00ed8d735cc1477`

OpenSpace attributes the grayscale Titan global mosaic to USGS and NASA/PDS
Cassini ISS. The pinned OpenSpace Hyperion asset has physical axes and a SPICE
transform but no color layer; it does not supply a Hyperion surface map.

### Minor moons

The other 285 catalog records retain their source identifiers and orbital facts.
They are not a rendered dot field in the current Saturn package.

</details>

<details>
<summary>Ring statistics cross-check</summary>

## Ring statistics cross-check

The ring boundaries and the faint inner D ring are cross-checked against the
NASA PDS Ring-Moon Systems Node's
[Saturn ring statistics](https://pds-rings.seti.org/saturn/saturn_rings_table.html).
The prepared image extends through the F ring's 140,612 km outer boundary and
includes the documented D-ring ringlets at 67,580 km and 71,710 km.

</details>
