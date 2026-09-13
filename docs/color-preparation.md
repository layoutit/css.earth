# Source-backed surface color

Source calibration, image registration and display color answer different
questions. A registered, calibrated infrared image does not establish the color
of a surface to a human observer. These rules apply to every body and preparation
lane; the runtime renderer only receives prepared display assets.

## Source interpretation comes first

| Source | Preparation | What the result can claim |
| --- | --- | --- |
| Publisher-prepared RGB image or RGB mosaic | Preserve the published channel order and display processing; honor an embedded color profile where the decoder supports it. Do not apply a second transfer intended for raw measurements. | The publisher's documented natural, approximate, enhanced or false-color interpretation. Three channels alone establish none of these. |
| Calibrated spectral bands | Validate the native band identities and units, register each observation, retain floating values through sampling and compositing, and apply an explicit scientific display at the end. | A band composite. Calibration or an sRGB output does not qualify it as natural color. |
| Archive-derived, sharpened spectral mosaic | Preserve the archive's band identities and processing. Treat the values according to the archive, without relabeling them as untouched radiance or reflectance. | The published derived/enhanced interpretation, with our additional display transfer identified. |
| One measured band | Use its documented monochrome display and coverage. | Monochrome observations, not recovered surface color. |
| Numeric scientific field or categories | Use the declared palette, range, units and legend. | A visualization of that field, not photographed color. |
| Shape-only model | Use the existing model presentation. | Measured or modeled shape, without a photographic color claim. |

Do not infer a missing visible band from infrared/ultraviolet, invent a camera
color matrix, white-balance to an assumed neutral patch, or adjust saturation
until a body looks plausible. A natural-color reconstruction requires a cited
method applicable to the actual instrument and inputs, its supported calibration
and registration, and evidence appropriate to that claim. If that evidence is
missing, retain an explicitly scientific interpretation or defer the natural-color
view. A description or a successful geometric fit cannot supply missing evidence.

NASA explains the distinction between [measured visible RGB and false-color
band combinations](https://science.nasa.gov/earth/earth-observatory/how-to-interpret-a-false-color-satellite-image/).
Even the Cassini visible-band approximation in [Ordóñez-Etxeberria et al. (2019),
section 5](https://arxiv.org/abs/1905.02978) explicitly acknowledges instrument/eye
response differences and a synthetic red band. That Jupiter-specific method is
not a universal calibration for other bodies.

## Keep measured values until the display boundary

The shared [color transfer](../tools/objects/color-transfer.mts) builds one
band-composite display per product. The route names the actual ordered bands and
their quantity from what it reads, checked against native labels where the product
has them, and the recipe declares only the common `displayRange`. Each route
refuses any other key, so a recipe has no place for natural-color claims,
independent channel gains or automatic white balance. Photometrically matched
color is compared with its monochrome base in display-linear light, so that method
fixes its range at 0 to 1. Already encoded image bytes cannot be sent through the
floating-band encoder.

The common range assigns normalized measurements to **linear display channels**.
This assignment is a scientific visualization, not an instrument-to-eye transform.
Interpolation, photometric corrections and overlap blending precede display
encoding. Missing-band footprints remain missing. Only the final output clips
values and quantizes them to eight bits.

The final transfer follows [IEC sRGB, as published by the ICC](https://registry.color.org/rgb-registry/files/sRGB.pdf):
for a bounded linear channel `L`, the code value is `12.92 L` below or at
`0.0031308`, and `1.055 L^(1/2.4) - 0.055` above it. An 18% linear channel maps
to byte 118, not 46. Writing linear measurements directly as display bytes
exaggerates channel differences when the display decodes those bytes.

This correct encoding does **not** turn IR/UV data into natural color. It makes
the chosen scientific display consistent with its declared linear channel values.
The display range is an explicit visualization choice, not a measured albedo
maximum or a new calibration constant.

## Current routes and scope of the repair

The preparation audit distinguishes producers, not body names. The retained
[all-object registration review](provenance/surface-registration-review.md)
provides the full 473-package disposition and its earlier reviewed revision;
this color repair does not promote its unresolved registration cases:

- `controlled-shape-color`: Pan, Atlas, Daphnis, Prometheus, Pandora, Janus,
  Epimetheus, Hyperion and Proteus. The cameras now produce floating samples for
  color composition, rather than pre-quantized monochrome images. Native labels
  must agree with the selected filters and calibrated reflectance units. All
  complete triplets share one overlap weight. The existing monochrome route
  remains separate.
- `terrestrial-observed-color`: Europa's Galileo I/F bands. Photometry and
  common brightness matching run before the final encoding. The already prepared
  monochrome base is decoded only as a display reference for that matching;
  its brightness does not establish natural color or new radiometric calibration.
- `pds4-float-rgb`: Charon's archive-produced, pan-sharpened MVIC composite.
  Its values are derived band values, not untouched I/F. The reader validates
  the archived wavelengths and applies its explicit common display range once.
- `nh-mvic-camera`: Arrokoth's registered, PSF-matched MVIC cube, through the
  [shared surface-observation pipeline](../tools/objects/surface-observations/README.md).
  Its native PDS label binds BLUE/RED/NIR/CH4 order, wavelengths and data-number
  units. The selected NIR/red/blue values remain floating through the shared
  footprint, photometry and surface transfer; the same encoder finishes the
  atlas samples and map preview, and its policy appears in the standard report.
- Published RGB/byte-band mosaics, static images, geographic imagery, giant-planet
  observations, scientific palettes and shape presentations do not enter this
  floating-band encoder. Their established source display interpretation is
  preserved; this change does not requalify them as natural color.

The audit located twelve active surfaces in four affected routes. The new shared
surface-observation pipeline from PR #173 is included in this repair. It also
searched 2,015 preparation JSON files smaller than 1.5 MB for authored color
matrices, white balance, saturation and tonal overrides; the only matching
active color-space fields were Io's existing sRGB decoder settings. That search
is a configuration inventory, not independent scientific validation of every
published image or a claim that every body has measured natural color.

## Evidence must match the claim

Check native band identities, units and registration separately from display
encoding. Numeric reference cases prove the transfer, late clipping and the
absence of double encoding. A rendered comparison can show the display change;
it cannot validate natural color without a suitable source reference.

The raster lane retains decoder reports per prepared density in its surface
metadata. Camera composites keep the policy in their source-grid report; the
shared surface-observation lane includes it in its standard display report.

Keep the input/output hashes, color policy and inspected product captures with
the body evidence. Reuse unchanged camera holdouts only with an explanation of
why the display-only work leaves their geometry and source samples applicable.
Follow the [visual-comparison contract](provenance/CONTRACT.md#say-what-the-checks-prove);
do not Pixelmatch different spectral combinations to claim fidelity.

For the 2026-09-13 refresh, each body's capture records the exact recipe, runtime,
transfer and delivered-image hashes, compared with retained geometry at
`8cc1a2fae`. Source registrations and native observations are unchanged. Captures
made before the final capture-helper edits remain applicable: those edits add an
optional viewpoint, an installed-Chrome selector and larger diagnostic response
buffers; they do not change prepared data or rendering. Europa's capture faces
its measured color footprint rather than the unchanged initial viewpoint.

A photographic refresh resolves declared monochrome dependencies for decoding
and minimaps while packing only the selected surface. Caption updates expand the
checked-in runtime/scene twins and re-pin their transport without recompiling
texture geometry or seam treatment. This prevents a content update from silently
changing the retained scene after a merge.
