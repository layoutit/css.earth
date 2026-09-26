# Saturn sources

Saturn combines a Hubble OPAL visible body map, Hubble spectral maps, a Cassini
UVIS ring opacity profile, schematic thermal and interior views, and modeled
atmosphere charts.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Sources

| View or quantity | Source |
| --- | --- |
| Visible body | [Hubble OPAL Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-32) rotation-A F395N/F502N/F631N global map, 2025-08-29; unobserved polar and ring-occluded rows are filled during preparation |
| Visible body colour | [Karkoschka (1998)](https://doi.org/10.1006/icar.1998.5913) full-disc albedo spectrum, [PDS `1995LOW.TAB`](https://pds-atmospheres.nmsu.edu/PDS/data/gbat_0001/data/1995low.lbl) (ESO, July 1995, rings edge-on) |
| Ring opacity profile | [Cassini UVIS HSP alpha Virginis occultation, 2006 day 285](https://pds-rings.seti.org/holdings/volumes/COUVIS_8xxx/COUVIS_8001/data/UVIS_HSP_2006_285_ALPVIR_I_TAU01KM.LBL), 1 km bins, PDS CO-SR-UVIS-HSP-2/4-OCC-V3.0 |
| Ultraviolet and methane bands | [Hubble OPAL Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-saturn-cycle-32), 2025 |
| Ring boundaries and motion | [PDS ring statistics](https://pds-rings.seti.org/saturn/saturn_rings_table.html) and JPL SAT441 |
| Interior | [Mankovich and Fuller (2021)](https://doi.org/10.1038/s41550-021-01448-3) and [Movshovitz density profiles](https://doi.org/10.7291/D1P07G) |
| Atmosphere charts | [NASA Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/), modeled 29 August 2026 |

## Evidence

On 2026-09-20, Saturn was regenerated from its checked source closure and
inspected in Chromium at a 1,440 x 1,100 CSS-pixel viewport. The retained DOM
contained no `saturn-weather` asset or style reference. The matched-camera
[before/after crop](evidence/weather-overlay-removal.webp) shows the former
project-authored storm ovals on the left and the source-backed visible mosaic
on the right. This image is review evidence, not an input to the runtime view.

The focused no-weather regression passes against the prepared scene, runtime
inventory and provenance document. The independent radial-preparation test
also reproduces all four canonical ring lenses, confirming that removal of the
weather path did not alter the Cassini UVIS ring recipe.

## Known problems

- Ultraviolet and methane views contain filled rows and added visible-light detail; they are not pure single-band observations.
- Thermal colors and interior layers are illustrations. No measured global thermal raster is qualified here.
- Ring opacity and narrow features are enhanced for readability; they do not establish optical depth or fully resolved ringlets.
- Rotation is accelerated. The camera, shadows and background orientation are presentation choices, and source observations come from different dates.
- The visible map's colour balance is tied to one whole-disc spectrum from 1995; the 2025 map's own cloud colours are kept, but a seasonal change in Saturn's overall colour since 1995 would not show. The tie sets channel ratios only; the map's overall brightness is still the archive TIF's arbitrary scale, kept at its untied mean, and its brightest 4 % of texels are compressed by a soft shoulder.
- The map's blue channel is F395N (violet) data, displayed as sRGB blue with the F467M limb law. The navigation portrait and context image still crop the untied TIF.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

The recipe binds Saturn's settings to the shared
[material-composition preparer](../../../tools/objects/material-composition/index.mts),
which uses the shared radial, cutaway, sky and content preparation modules.

- The material overlay has one colour and alpha per texel, so the per-channel limb law is exact for the prepared surface's mean colour and approximate for colours far from it ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)). OPAL's coefficients are for near-zero phase; directional frames use them at every phase.

<details>
<summary>Dimensions, motion and navigation portrait</summary>

## Body and rings

The geometry recipe states Saturn's radii as 60,268 km, 60,268 km and
54,364 km (the IAU values in NAIF `pck00011.tpc`), the body transform as a
SPICE translation and rotation, and the ring extent as 66,900 km to
140,612 km. Ring opacity comes from the UVIS occultation profile below; the
ring plane is bound to NASA/NAIF's `sat441.bsp` Saturn kernel.

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

The navigation portrait crops the pinned Hubble OPAL global map. Because this is a flat map rather than an already-lit disc photograph, the shared marker preparer applies full-phase curvature inside its existing oblate ellipse (35% ambient, 65% diffuse). The centre retains the map brightness and the limb darkens symmetrically; no directional terminator or new surface detail is added. Both the small navigation atlas and the resolved Saturn context image use this same authored recipe.

</details>

<details>
<summary>Visible color, polar imagery and source pins</summary>

## Texture assets

The body map is the Hubble OPAL Cycle 32 rotation-A global map of
2025-08-29, the archive's F395N/F502N/F631N composite
(`hlsp_opal_hst_wfc3-uvis_saturn-2025a_f395n-f502n-f631n_v1_globalmap.tif`,
1,800 x 900, NASA, ESA, STScI and the OPAL team). The map never observed three
row ranges: rows 0-35 (north of 82.8 degrees), rows 431-444 (3.8 to 1.0
degrees north, behind the rings) and rows 887-899 (south of 87.4 degrees).
These latitudes are planetographic: the
[OPAL Cycle 32 readme](https://archive.stsci.edu/missions/hlsp/opal/cycle32/saturn/hlsp_opal_hst_wfc3-uvis_saturn-2025_all_v1_readme.txt)
says the maps run "between -90 and +90 deg planetographic latitude" with the
"left edge = 360 System III W. longitude, decreasing to the right".
The geometry recipe names those rows and preparation fills them by linear
interpolation in latitude between the nearest observed rows before resampling
the map to the 2,880 x 1,440 grid; nothing is detected from pixel values.
The north cap is then replaced by the Cassini polar projection as described
below. The rotation-B map of the same year has the same unobserved rows, so
it cannot fill them.

Colour. The OPAL README calls the colour TIF "arbitrarily scaled", with "slight
contrast enhancement": its channel balance is not a measurement. Untied, the
map rendered 1.4 times too blue (blue/red 0.65 in linear light, against 0.48
for Saturn), and the blue limb turned grey-blue. Preparation now ties the
map's channel balance to a measured whole-disc colour, the pattern the Uranian
moons use for their Voyager colour. The colour comes from Karkoschka's
full-disc albedo of Saturn at 5.7 degrees phase with the rings edge-on
(ESO, July 1995; [Icarus 133, 134-146](https://doi.org/10.1006/icar.1998.5913);
[PDS `1995LOW.TAB`](https://pds-atmospheres.nmsu.edu/PDS/data/gbat_0001/data/1995low.tab)),
times a 5,772 K Planck spectrum, through the CIE 1931 observer into linear
sRGB with the repository's own colour code: 0.6168, 0.4713, 0.2982, `#ceb794`,
green/red 0.7640 and blue/red 0.4834. It is recorded in
[`source/photometry/karkoschka-1998-whole-disc-colour.json`](source/photometry/karkoschka-1998-whole-disc-colour.json);
the table itself is cited, not stored. Karkoschka measured the whole disc,
limb darkening included, while OPAL divided each filter's limb darkening out
of the map and the lighting overlay puts it back per channel. So the map is
tied to that colour divided by each channel's disc mean of the limb law
(0.7694, 0.8698 and 0.7354, the Minnaert 2/(2k+1)): green/red 0.6759 and
blue/red 0.5057. The solar-tinted map measured 0.9272 and 0.6953
(cosine-weighted means in linear light), so green is scaled by 0.729 and blue
by 0.7273, and red is kept. The flood-lit disc then integrates to
Karkoschka's colour; tying the map's own mean instead left the rendered disc
greener (green/red 0.856) with an olive limb. Keeping red and lowering green
and blue also made the map a fifth darker (cosine-weighted luminance 0.426 to
0.337), and in the app Saturn looked brown. So the tied map then gets back its
untied luminance: one factor on all three channels, 1.264, which keeps the
tied ratios. With that factor alone red would clip on 0.5 % of texels, so a
texel whose brightest channel passes 0.8 of full scale is compressed by a soft
shoulder, 0.8 + 0.2 (1 - exp(-(m - 0.8) / 0.2)), all three channels by the
same amount: 4.35 % of texels, none clipped, each keeping its own ratios. The
largest factor that clips nothing, 1.085, left the disc dark. `node --test
tools/photometry/whole-disc-colour.test.mts
tools/objects/material-composition/layered-oblate.test.mts` checks the record,
the disc means, these gains, the luminance factor and the shouldered share on
the restored map. Spatial colour
differences stay the map's own. An independent spectrum agrees: Saturn's
swatch, from the Payne et al. (2026) composite reference spectrum with the Sun
adapted to the D65 white, has green/red 0.863 and blue/red 0.589, where
Karkoschka's spectrum lit by D65 gives 0.863 and 0.593.

The ring opacity is the Cassini UVIS high-speed photometer stellar
occultation of alpha Virginis on 2006 day 285 at 1 km radial bins (PDS
`COUVIS_8001`, Colwell, Jerousek, Becker and Esposito). Of the 73,713 bins
between 66,900 and 140,612 km, 60,886 carry a measured normal optical depth,
4,518 are clean bins below the instrument's detection floor and count as
empty, and 8,309 are flagged corrupted and are interpolated from their
neighbours. Each bin becomes a transmission byte, 255 times exp of minus the
optical depth. No qualified radial colour dataset exists: the Cassini ISS
natural-colour ring mosaics in the Photojournal are perspective views, not
radius-indexed strips, so the ring colour is uniform white under the declared
solar tint. The earlier hand-authored gap clearings, alpha caps and F-ring
core are gone; the Encke and Keeler gaps, the Cassini division and the F
ring come from the occultation.

[`evidence/opal-surface-uvis-rings.webp`](evidence/opal-surface-uvis-rings.webp) shows
the prepared solar-tinted body surface and the prepared ring texture from this
source pair, as inspected before acceptance.

`source/approved/saturn-fixed-material.webp` is a comparison reference. The
default frame is regenerated by the same model as the orbit bank; the reference
is not a source of runtime pixels.

- OPAL global map: `c34a13a8253a39bcc1f8376b24c077b89f05ce0b5202706f535ded20314440d7`
- UVIS occultation profile `UVIS_HSP_2006_285_ALPVIR_I_TAU01KM.TAB`:
  `65bd6d68c20a40c98e751480dad2832bac791dfa898226e30a9f573664250341`

The OPAL map does not observe the pole itself. The declared unobserved rows are
filled by latitude interpolation before both polar caps are projected. The
default body therefore remains one Hubble epoch and color treatment instead of
pasting a 2017 Cassini polar image over the 2025 Hubble map. This fill supplies
no measured cloud detail inside the missing rows.

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
pansharpening pass transfers only high-frequency detail from the prepared
OPAL visible-light surface. Its scale is clamped to 0.88 through 1.12, so
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
color and luminance while retaining the UVIS occultation alpha profile,
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
uniform ring colour receives the same `#fff1ea`
linear-light solar chromatic multiplication as the planet surface. Its band/gap
morphology and relative brightness ordering remain unchanged outside the
declared inner opacity presentation; the motion accents target the same warm
solar white instead of neutral white. The G-ring, Janus-Epimetheus, and E-ring
dust candidates are not published. The four C-, B-, and A-ring plates provide the displayed motion.

</details>

<details>
<summary>Surface and polar map projection</summary>

The shared material-composition preparer projects the oblate globe and ring
plane. It fills the OPAL map's unobserved rows, resamples the 1,800 x 900 map
to the 2,880 x 1,440 longitude-latitude grid with a Lanczos-3 kernel, and maps
that onto the retained grid. The byte-identical source is retained under
`source/observations/`. Preparation applies the declared solar color to it in linear light and writes
the continuous derived `saturn-surface.jpg`. The retained projective leaves use
`saturn-surface-body.jpg`, which reverses the rows inside each 90-pixel latitude
strip because the direct projective image leaf maps its first polygon edge to
the top of the source rectangle. This makes adjacent retained bands meet on
adjacent north/south source texels. It changes no geometry and performs no
runtime filtering. Each 90 x 90 UV source cell is sampled by a 64 x 64 PolyCSS
raster leaf, giving the textured bands a 2,048 x 896 prepared paint density.

The polar regions are projected offline into the lossless 4,096 x 512
`saturn-poles.webp` atlas instead of being represented by solid triangle fans.
Both discs inversely map each prepared sample into the filled OPAL
equirectangular map. The north pole uses the repeated nearest observed row
north of 82.8 degrees; the south pole uses the repeated nearest observed row
south of 87.4 degrees. The atlas contains separate 512 x 512 north/south albedo
and fixed-world material tiles for both visible polar discs and two larger caps
inset behind their boundaries. The inset tiles clamp their outer samples to the
visible caps' exact source and material boundary, so they close subpixel raster
gaps without stretching different texels through the seam. These form eight
prepared tiles: source and fixed-world material tiles for
the visible and inset caps.

</details>

<details>
<summary>Prepared lighting and mutual shadows</summary>

The separate material overlays put back the limb darkening OPAL removed from
the colour map, with the Cycle 32 README's own Minnaert coefficients: k 0.80 in
F631N (red) and 0.65 in F502N (green). The blue channel takes F467M's k 0.86
(the README's table row reads "F467M 0.86 .00507"), not F395N's 0.40: once the
map's colour is tied to Saturn's true colour, its blue channel stands for light
near the sRGB blue primary, and only 13 % of that channel's signal in Saturn's
sunlit spectrum comes from 380-429 nm, where F395N sits. F467M is the README
filter closest to the primary. With F395N's k below 0.5 the blue limb
brightened under full light, and Saturn's limb turned grey-blue (b* -16 at the
rim)
([README](https://archive.stsci.edu/missions/hlsp/opal/cycle32/saturn/hlsp_opal_hst_wfc3-uvis_saturn-2025_all_v1_readme.txt);
[planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)).
They are recorded in `source/photometry/opal-2025-minnaert-*.json` and
evaluated relative to the flood-lit disc centre on continuous per-texel oblate
normals, times the rings' direct transmission where their shadow falls. They
replace the authored pearl-blue limb colour, the 0.05 ambient intensity, the
Oren-Nayar term and the smoothstep terminator, all adapted from OpenSpace and all
removed. This adapter keeps the warm solar presentation. NASA's
[Sun fact sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/sunfact.html)
gives the solar photosphere an effective temperature of 5,772 K. The prepared
`#fff1ea` multiplier is derived from a 5,772 K Planck distribution through the
CIE 1931 observer and linear sRGB/D65, normalized by its maximum channel. This
is a declared colorimetric display approximation, not flat white light or a
full spectral renderer. The constant solar spectrum is multiplied into the
surface texels once during preparation. Each material texel is one source-over
colour and alpha, exact for the prepared surface's mean colour (measured at
bake). The 5,188 x 4,160 `saturn-orbit-material.webp` RGBA preparation master packs
256 prepared camera-elevation material fields in a 16 x 16 grid. Each field has
a 256-pixel tile and a two-pixel gutter. Runtime export retains one active
variant atlas and one generated high-resolution default frame. The four lenses
each have full, no-shadow, and ringless exterior and cutaway masters, so the
controls remove only the requested phenomena without removing Saturn's
lighting. The browser selects one prepared address only when camera input
changes. It performs no lighting playback while the scene is idle. The material
stores the view- and light-dependent limb from prepared oblate normal samples
over the solar attenuation. CSS therefore paints one material background over the surface
instead of separate atmosphere and shadow layers. The earlier project-authored
three-storm texture and the cross-mission Cassini polar cap are no longer
rendered: the visible body now contains only the declared Hubble map and its
explicit row fills, alongside the separately declared Cassini UVIS rings and
prepared lighting presentation.

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

The source archive lists the eight major moons Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Hyperion, and Iapetus. Their mean
radii, semimajor axes, eccentricities, inclinations, nodes, arguments of
periapsis, mean anomalies, and periods come from JPL Solar System Dynamics'
[SAT441 physical parameters](https://ssd.jpl.nasa.gov/sats/phys_par/sep.html)
and
[mean elements](https://ssd.jpl.nasa.gov/sats/elem/sep.html), whose declared
epoch is `2000-01-01.5 TDB`.

Each of these moons is its own object package with its own surface sources;
this package pins no moon maps.

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
