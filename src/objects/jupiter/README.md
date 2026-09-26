# Jupiter source and preparation record

Jupiter combines Hubble observations, qualified polar illustrations, a faint ring model, and modeled atmosphere charts.

Source selections, recorded trials and open questions are in the [investigation ledger](investigations.json).

## Sources

| View or quantity | Source |
| --- | --- |
| Visible clouds and polar structure | [Hubble 2019 global map](https://science.nasa.gov/asset/hubble/jupiter-global-map-2019/) and Juno products listed below |
| Ultraviolet and methane bands | [Hubble OPAL Cycle 32](https://archive.stsci.edu/hlsp/opal/opal-jupiter-cycle-32), 2025 |
| Ring structure | [PDS ring statistics](https://pds-rings.seti.org/jupiter/jupiter_rings_table.html) and Galileo images |
| Atmosphere charts | [NASA Planetary Spectrum Generator](https://psg.gsfc.nasa.gov/), modeled 30 August 2026 |

## Evidence

The record describes image-background and source-value checks, but cites no dated test or browser run. Source byte pins are in the input manifest.

## Known problems

- The polar views combine visible and infrared structure without registration to the Hubble longitudes; they are structural illustrations.
- Spectral gaps remain missing. The edge-fill mask is a heuristic without an independent validity mask.
- Ring contrast and widths are enhanced for visibility. Atmosphere lighting and charts are models, and the display rotation is accelerated.

[Inputs](source/manifest.json) · [Recipe](object.json) · [Credits](NOTICE.md) · [Contributor guide](../README.md)

- The photometric overlay has one colour and alpha per pixel, so the per-channel limb law is exact for the 2019 map's mean colour and approximate for colours far from it ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)). The coefficients are for near-zero phase; directional frames use them at every phase.

<details>
<summary>Input pins and preparation</summary>

Jupiter is prepared only from the checked inputs declared in
`source/manifest.json`. Each entry fixes the expected byte count and SHA-256.
Required ignored binaries have pinned restoration routes in
`source/preparation/acquisition.json`; the shared acquisition operators reject
any response that does not match the declared snapshot.

## Reproduction

Object-owned JSON supplies observations and polar qualification, oblate geometry,
radial layers, photometry, celestial state, presentation, content, and charts.
Shared capability operators under `tools/objects/` regenerate encoded assets
and prepared JSON from those pinned inputs. The package contains no preparation
or runtime executable code. Commands are in the [contributor guide](../README.md).

</details>

<details>
<summary>Body dimensions and background sky</summary>

## Body and scene facts

The visible body uses the NASA/ESA Hubble WFC3 global map made from observations
on 27 June 2019. The source product is 3,600 by 1,800 pixels and combines the
395, 502, and 631 nm filters. Its published product page states that latitudes
beyond 80 degrees are excluded. Preparation fixes DPR 1 and DPR 2 surface banks,
reorients each latitude band for the retained projective leaves, and produces
the polar-cap atlas before runtime. Preparation verifies measured rows 101
through 1,698 and carries the curved retained body to 80°S and 80°N. Bands are
limited to eight degrees, below Saturn's accepted 11.25-degree band span, to
reduce close-zoom faceting.

Poleward of 64° the body is a dome: two rings on each side (64° to 72° and 72° to
80°, 64 quads each, so every band vertex at 64° is also a ring vertex) and a flat
cap at 80°, rounded to a disc like every polar cap. Preparation lays the polar
atlas over the Hubble map there through the atlas's own projection (latitude
linear from the pole to 64°) and its alpha, the composite the former overlay
plate showed over the bands, so one surface carries both. A ring leaf maps its
rows onto its flat trapezoid projectively, so each ring row is written with the
latitude its leaf shows it at: on the prepared leaves every texel lands within
0.33 of a 2x polar-atlas texel of its latitude, where plain rows missed by up to
12. The cap shows its atlas tile within 0.39 of a texel. The cap's rim stands
0.15% of the radius outside the body and nothing else does; the overlay plate it
replaces floated at the 80° height out to 64° and reached up to 5.7% of the
radius past the limb when seen from 10° above the equator. The atlas tiles are
now laid out the way the caps draw them: the plate showed the north tile a
quarter turn and the south tile mirrored from the longitudes the atlas was made
for, so the Juno structure turns accordingly.

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

The prepared scene binds the IAU equatorial and polar radii (71,492 and
66,854 km) and the JUP365 ephemeris closure. The prepared scene
uses 3.13 degrees of axial tilt and NASA's 9.9-hour rotation period. The
36-second CSS rotation is an explicitly accelerated presentation timescale.
The adapter declares a 1,280 by 720 prepared reference viewport for its
Galilean system and uses a prepared default zoom of 1.1. The shared, opt-in
render-root scale fits that reference into smaller containers while preserving
one scale for the retained camera and prepared photometric plane. Runtime does
not measure or independently resize Jupiter geometry.

The shared camera owns input and transports retained prepared state. Jupiter's
source-owned JSON supplies its geometry, camera conventions, materials, and
initial orientation. The obsolete private camera/billboard transform bank is
not an input to this shared runtime.

## Background stars

</details>

<details>
<summary>Surface observations and polar reconstruction</summary>

## Surface lenses

The Hubble OPAL Cycle 32 high-level science products observed on 11 December
2025 provide two single-band global maps:

- `F275W` at 275 nm for the ultraviolet lens.
- `FQ889N` at 889 nm for the methane-band lens.

Both FITS products are single-band measurements from 11 December 2025.
Preparation preserves the measured values, including dark and finite negative
samples. The pinned maps contain exact-zero exterior fill but no separate
validity extension. Only exact-zero regions connected to a polar source edge,
and any non-finite samples, are marked unavailable; isolated interior zero
samples remain observations. This conservative coverage rule is an explicitly
qualified interpretation of the source fill, not a brightness threshold.

The scalar map, both surface densities, polar atlases and thumbnail use the
same validity mask. Interpolation rejects footprints containing missing
samples. Gray grid marks those gaps. A measured-pixel percentile stretch and
false-color palette provide relative display contrast. No Juno structure,
harmonic extrapolation or neighboring longitude fill supplies spectral data.
The normal visible-color composite still has its separately disclosed Juno
polar illustration; it is not a new geodetic map.

</details>

<details>
<summary>Satellite archive and ring structure</summary>

## Satellite source archive

The checked JPL Solar System Dynamics discovery and mean-elements snapshot
retains its 115-satellite catalog. The NASA/JPL/DLR Galileo PIA01299 montage
remains pinned source material. Neither has been replaced or discarded.
The shared runtime mounts exactly one detailed object scene: Io, Europa,
Ganymede, and Callisto have their own object packages and navigation entries.
Dormant Jupiter-owned billboard and orbit-guide derivations are excluded from
the active asset inventory; their exact retired filenames are recorded in
`object.json`. No embedded-moon rendering pipeline is required to prepare
Jupiter's active scene.

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

</details>

<details>
<summary>Atmosphere models and charts</summary>

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
`k=0.950`, and F395N blue `k=0.850`; the Cycle 32 2025 README repeats them. They
are transcribed into three model records, `source/photometry/simon-2015-minnaert-*.json`;
the paper is linked, not redistributed. Preparation puts the channel-specific
Minnaert law back on the limb-corrected Hubble map, relative to the flood-lit disc
centre, for every prepared light direction ([planet limbs](../../../docs/surface-preparation.md#planet-limbs-from-published-laws)).
This keeps Jupiter's measured wavelength-dependent centre-to-limb behavior.

The pinned PSG configuration retains its exact `4.360399` degree observation
phase and observation light direction as source metadata. That near-opposition
geometry is not used as the free-orbit presentation light because it collapses
the visible terminator into an unreadable limb. Presentation instead copies the
accepted Saturn presentation Sun direction `[0.883835, -0.385595, 0.264864]`
into Jupiter's object-owned preparation. The direction is an authored
presentation choice, originally OpenSpace's default scene-graph light, and is
not derived from a screenshot.

The prepared photometric overlay adds nothing to the law: the `0.05` ambient
floor, the `smoothstep(0, 0.1, N dot L)` terminator and the cap at the centre's
brightness are gone. Every channel is computed in linear light, re-encoded
through sRGB, and represented as a single source-over color plus alpha, exact for
the map's mean colour (measured from the 2019 map at bake) rather than the grey
160 used before. The accepted material bank contains 181 half-degree frames at 512 pixels,
packed four frames per row with an eight-pixel gutter. Its 46 lossless row
assets and one shadowless asset retain the accepted encoded bytes and immutable
URLs. The shared bounded residency owner selects prepared rows and addresses;
runtime performs no lighting, gamma, photometry, atmosphere, or raster work.

The source-over solution is exact for the declared neutral sRGB reference
channel value of 160. Over the spatially varying Hubble color texels it is a
bounded photometric overlay, not a claim of per-texel spectral radiative
transfer. Preserving that qualification avoids inventing an unvalidated
volumetric haze model.

The checked NASA GSFC Planetary Spectrum Generator configuration expands a
pinned `2026/08/30 12:00` Jupiter ephemeris seed. It contains the 50-layer
Moses et al. 2005 Jupiter atmosphere from 10 bar to 10 nanobar. The checked
R=240 I/F response contains 253 samples from 0.35 to 0.998 micrometers. The
reflectance and temperature-pressure charts use those snapshots; the third
chart uses the pinned photometric phase coefficients. All charts are generated
as static SVG assets before runtime.

</details>

<details>
<summary>Presentation references and authoritative pages</summary>

## Presentation sources

The navigation marker is the credited NASA/ESA/STScI/Amy Simon Hubble view from
5 January 2024. Its source and preparation recipe are adapter-owned.

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

</details>
