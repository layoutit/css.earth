# Jupiter source and preparation record

Jupiter is prepared only from the checked inputs declared in
`source/manifest.json`. Each entry fixes the expected byte count and SHA-256.
`pnpm acquire:planets -- --verify-only` verifies those bytes without using the
network. `node tools/acquire.mjs --refresh` is the explicit networked refresh
path and rejects any response that does not match the declared snapshot.

## Body and scene facts

The visible body uses the NASA/ESA Hubble WFC3 global map made from observations
on 27 June 2019. The source product is 3,600 by 1,800 pixels and combines the
395, 502, and 631 nm filters. Its published product page states that latitudes
beyond 80 degrees are excluded. Preparation fixes DPR 1 and DPR 2 surface banks,
reorients each latitude band for the retained projective leaves, and produces
the polar-cap atlas before runtime. Preparation verifies measured rows 101
through 1,698 and carries the curved retained body to 80°S and 80°N. Four
prepared high-latitude rings on each side replace the former single stretched
band. Interior bands are limited to eight degrees, below Saturn's accepted
11.25-degree band span, to reduce close-zoom faceting. The polar overlay is
opaque only across the remaining 80° geometric
opening and becomes fully transparent before its 64° source-matching edge.
That retained alpha transition preserves the curved silhouette without a
visible circular plate.

The north-pole cyclone structure comes from the checked NASA/JPL PIA23808
JunoCam polar projection. That publication uses extreme false color, so its
RGB values are discarded: preparation transports bounded luminance structure
only. Chroma comes from the checked visible-light PIA24239 regional product,
credited to Emma Wälimäki under CC BY, and from the measured Hubble 64° edge.

The south-pole cyclone structure comes from checked PIA23556 JIRAM 5-micron
imagery. Its infrared palette is likewise discarded. Chroma comes from checked
visible-light JunoCam PIA21382, processed by John Landino under CC BY, and from
the measured Hubble edge. Both structure maps are blended into the 64° to 80°
body bands and the prepared polar atlas. Their cyclone arrangements are
source-backed, but the sources are not registered to the Hubble map's
longitudes; this is a structural polar presentation, not a new geodetic map.
The atlas also retains the first 32 angular modes from a half-degree Hubble
boundary band. No absent Hubble pixel is presented as an observation, and no
polar geometry, projection, color transfer, or raster work occurs in the
browser.

OpenSpace's Jupiter globe and kernel assets at commit
`56e29b54b8592084ff1fef47c2e08de0b22ce516` bind the equatorial and polar
radii (71,492 and 66,854 km) and the JUP365 scene closure. The prepared scene
uses 3.13 degrees of axial tilt and NASA's 9.9-hour rotation period. The
36-second CSS rotation is an explicitly accelerated presentation timescale.
The adapter declares a 1,280 by 720 prepared reference viewport for its
Galilean system and uses a prepared default zoom of 1.1. The shared, opt-in
render-root scale fits that reference into smaller containers while preserving
one scale for the retained camera and prepared photometric plane. Runtime does
not measure or independently resize Jupiter geometry.

The exact 0.01-degree vertical camera states and their matching moon-billboard
states are generated before runtime and stored as one content-addressed,
gzip-compressed local transform bank. Runtime validates, decodes, and directly
publishes those prepared strings. It does not construct camera or billboard
matrices, interpolate states, or request an external service.

## Background stars

The background is prepared from the checked HYG Stellar Database v4.1 subset
in `source/stars/hyg-v41-field.json`, credited to David Nash / Astronexus and
licensed under CC BY-SA 4.0. The file retains the catalog identifiers,
positions, apparent magnitudes, color indices, pinned source hash, projection,
and license. Preparation rasterizes the 600 brightest retained entries into
one deterministic 2,560 by 1,440 lossless WebP. The browser mounts that single
static image: it creates no star nodes, performs no catalog projection, and
does not animate the background. Its orientation is illustrative because the
scene has no observer epoch or inertial camera orientation.

## Surface lenses

The Hubble OPAL Cycle 32 high-level science products observed on 11 December
2025 provide two single-band global maps:

- `F275W` at 275 nm for the ultraviolet lens.
- `FQ889N` at 889 nm for the methane-band lens.

Both FITS products are calibrated single-band measurements. Preparation reads
the primary floating-point image and accepts only a row with a complete 3,600
pixel longitude span as a polar coverage anchor. The resulting measured bounds
are rows 50 through 1,709 for F275W and 52 through 1,705 for FQ889N. Gaps inside
that measured band are closed horizontally. The polar atlas reprojects the
measured spectral pixels from 64° through the last complete source row with
nine-sample angular supersampling. Beyond that measured coverage, two low
angular modes preserve the Hubble band color and broad luminance while the
checked Juno PIA23808 north-pole and PIA23556 south-pole products supply only
the cyclone structure. Those Juno details are not direct F275W or FQ889N
measurements. A declared percentile stretch and false-color palette produce
fixed DPR surface, polar, and thumbnail assets. The browser applies no filters
or raster processing.

## Moon system

The checked JPL Solar System Dynamics discovery and mean-elements snapshot has
115 confirmed Jupiter moons, matching NASA Science's August 2026 count. Every
catalog object has one prepared retained scene leaf. Io, Europa, Ganymede, and
Callisto use camera-facing image billboards prepared directly from the
NASA/JPL/DLR Galileo PIA01299 montage. The remaining 111 moons use the same
static-epoch prepared marker model as Saturn's minor-moon system. Mean orbital
distance, inclination, node, phase, eccentricity, period, and source identity
remain in the prepared data. Display distances use a declared logarithmic
compression that preserves source orbital order; published eccentricity is
retained as data but not applied. All 57 catalog objects with IAU names retain
visible prepared labels; the other 58 use their source provisional designation
only in the prepared catalog record. Minor-moon nameplate widths and
collision-free offsets are prepared for all 181 half-degree material-camera
states from the lower view through the pole, with the four Galilean nameplates
reserved at the prepared CSS-animation start epoch. The browser mounts the 111
minor-moon leaves only when that opt-in layer is first enabled and then retains
them for subsequent visibility changes. Runtime selects one of 181 prepared
half-degree offset states; it does not measure or lay out labels.

## Ring system

The checked NASA Planetary Data System Ring-Moon Systems table fixes the ring
boundaries, normal optical depths, vertical thicknesses, and associated source
moons. The halo spans 100,000 to 122,400 km; the main ring spans 122,400 to
129,100 km; the Amalthea gossamer component reaches 181,350 km; the Thebe
component reaches 221,900 km; and its extension reaches 270,000 km. The table's
optical depths preserve the physical ordering from the main ring below
`8 x 10^-6` through the approximately `10^-9` Thebe extension.

The Galileo PIA00701 observation establishes the three-part halo, main, and
gossamer structure, the halo's vertical extent, and the ring truncation in
Jupiter's shadow. PIA01623 establishes the Amalthea and Thebe gossamer
components and the approximately two-to-one edge-to-center brightness. The
prepared model composites those measured components once, retains their source
thicknesses as metadata, and splits the result into a 4 by 4 retained tile grid
with no stacked transparent planes. Its prepared radial mapping uses the same
logarithmic inner-system
anchors as Jupiter's compact moon presentation: Jupiter's equator at 230
presentation units, Metis at 255, and Io at 285. This preserves the complete
source ordering while keeping the Thebe extension inside Io. The retained
camera uses 50 world units for each presentation unit; that scale is applied
before mount. Local assets include the pinned ray-to-oblate-Jupiter shadow. Its
physical direct transmission remains zero, while a declared 0.65 prepared
luminance multiplier darkens the shadowed arc without deleting its alpha
coverage from the scene.
Runtime selects one DPR bank and mounts the prepared leaves; it performs no
ring geometry, radial mapping, shadow, raster, or network work.

Jupiter's ring optical depths are orders of magnitude below an opaque surface.
The local clear-filter-neutral presentation therefore uses a declared
log-optical-depth contrast emphasis capped at 0.4 alpha. A 0.65 optical-depth
exponent keeps the main ring legible while pushing the much weaker halo and
gossamer components back toward their source-tenuous appearance. Like Saturn's
prepared responsive ring treatment, the narrow main ring has a three-unit
minimum presentation width. The model preserves every measured radial boundary
as prepared data, their mapped order, and the optical-depth ordering, but it is
explicitly a visibility presentation rather than a claim that the rings would
appear this bright to a nearby unaided observer. The body-specific ultraviolet
and methane surface lenses do not recolor the ring measurements.
The single prepared composite prevents source-thickness presentation from
multiplying a component's opacity while retaining the measured component
boundaries and relative brightness model.

## Atmosphere and charts

Jupiter's checked Hubble global map is already a visible-light map of its cloud
atmosphere; it is not a solid surface requiring an Earth-like gaseous halo. The
checked NASA/ESA/STScI/Amy Simon full-disc Hubble view from 5 January 2024 is the
silhouette authority. Preparation detects its connected disc and verifies
44,312 pixels in the normalized 1.005-to-1.03 exterior annulus. Every sampled
RGB channel is zero, so the exterior halo is explicitly absent rather than
artistically colored.

The checked OPAL paper by Simon, Wong, and Orton publishes the visible-map
channel construction and the empirical Minnaert coefficients used to remove
limb darkening before cylindrical projection: F631N red `k=0.999`, F502N green
`k=0.950`, and F395N blue `k=0.850`. Those facts are transcribed into the
checked `source/atmosphere/hubble-opal-minnaert.json`; the copyrighted paper is
linked, not redistributed. Preparation reapplies the channel-specific Minnaert
law to the limb-corrected Hubble map for the current observer and pinned PSG
light directions. This preserves Jupiter's measured wavelength-dependent
center-to-limb behavior instead of borrowing Saturn's pale atmosphere color.

The pinned PSG configuration retains its exact `4.360399` degree observation
phase and observation light direction as source metadata. That near-opposition
geometry is not used as the free-orbit presentation light because it collapses
the visible terminator into an unreadable limb. Presentation instead copies the
accepted Saturn-quality OpenSpace default scene-graph Sun direction
`[0.883835, -0.385595, 0.264864]` into Jupiter's object-owned preparation. The
direction is bound to OpenSpace commit `56e29b54` and is not derived from a
screenshot.

The prepared photometric overlay retains OpenSpace's neutral-light `0.05`
ambient floor and `smoothstep(0, 0.1, N dot L)` terminator. Every channel is
computed in linear light, re-encoded through sRGB, and represented as a single
source-over color plus alpha. The material bank is rendered at 1,024 pixels and
presented at 512 CSS pixels, giving exact DPR 2 coverage without changing the
accepted camera scale. One-frame row shards keep the two-row decoded working
set bounded to 8,652,800 RGBA bytes. Runtime only selects and addresses one of
181 prepared half-degree frames. It performs no lighting, gamma, photometry,
atmosphere, or raster work.

The source-over solution is exact for the declared neutral sRGB reference
channel value of 160. Over the spatially varying Hubble color texels it is a
bounded photometric overlay, not a claim of per-texel spectral radiative
transfer. Preserving that qualification avoids inventing an unvalidated
volumetric haze model.

The checked NASA GSFC Planetary Spectrum Generator configuration expands a
pinned `2026/08/30 12:00` Jupiter ephemeris seed. It contains the 50-layer
Moses et al. 2005 Jupiter atmosphere from 10 bar to 10 nanobar. The checked
R=240 I/F response contains 253 samples from 0.35 to 0.998 micrometers. Both
charts are generated as static SVG assets before runtime.

## Presentation sources

The navigation marker is the credited NASA/ESA/STScI/Amy Simon Hubble view from
5 January 2024. The Jupiter title is an exact outline extracted from the pinned
Inter Variable 4.001 font at weight 500 and optical size 28. Both sources and
their preparation recipes are adapter-owned.

## Authoritative pages

- NASA Jupiter facts: <https://science.nasa.gov/jupiter/jupiter-facts/>
- NASA Jupiter moons: <https://science.nasa.gov/jupiter/jupiter-moons/>
- Hubble Jupiter global map 2019: <https://science.nasa.gov/asset/hubble/jupiter-global-map-2019/>
- NASA/JPL PIA23808 north polar projection: <https://www.jpl.nasa.gov/images/pia23808-cyclones-of-color-at-jupiters-north-pole/>
- NASA Photojournal PIA24239 Jupiter north pole detail: <https://science.nasa.gov/photojournal/jupiter-north-pole-detail/>
- NASA Photojournal PIA23556 south polar cyclones: <https://science.nasa.gov/photojournal/jupiters-south-pole-cyclones-in-2016/>
- NASA Photojournal PIA21382 visible south pole: <https://science.nasa.gov/photojournal/jovian-stormy-weather/>
- Hubble OPAL Jupiter photometry: <https://doi.org/10.1088/0004-637X/812/1/55>
- Hubble OPAL Jupiter Cycle 32: <https://archive.stsci.edu/hlsp/opal/opal-jupiter-cycle-32>
- JPL satellite mean elements: <https://ssd.jpl.nasa.gov/sats/elem/sep.html>
- JPL satellite physical parameters: <https://ssd.jpl.nasa.gov/sats/phys_par/sep.html>
- NASA Galileo PIA01299: <https://science.nasa.gov/photojournal/the-galilean-satellites/>
- NASA PDS Jupiter ring statistics: <https://pds-rings.seti.org/jupiter/jupiter_rings_table.html>
- NASA/JPL Galileo PIA00701 main ring and halo: <https://pds-rings.seti.org/jupiter/galileo/PIA00701.html>
- NASA/JPL Galileo PIA01623 gossamer structure: <https://pds-rings.seti.org/jupiter/galileo/PIA01623.html>
- NASA PSG: <https://psg.gsfc.nasa.gov/>
- OpenSpace: <https://github.com/OpenSpace/OpenSpace>
