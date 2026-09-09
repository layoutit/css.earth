# Halley Giotto encounter-image intake

**Result: `UNQUALIFIED_SURFACE_LENS`.** Seven original Giotto HMC frames have
been acquired, decoded and visually inspected. The images are usable for
inspection, but their registration to the Stooke shape has not been established.
No encounter texture, surface coverage mask, camera attitude or new scene lens
is published. Halley's existing **Historical model** remains unchanged.

The [retrieval manifest](../../src/planets/comet-1p/source/reference/giotto-hmc-intake.json)
pins every source file by URL, byte count and SHA-256. The
[numerical report](evidence/halley-giotto-intake.json) records the original
headers, calibration, raster validity, dimensions and unresolved evidence.
The files are candidates, outside the preparation recipe and runtime inventory.

## Original release and decoding

The [NASA PDS SBN release](https://pdssbn.astro.umd.edu/holdings/gio-c-hmc-3-rdr-halley-v1.0/)
has DOI **10.26007/xq9s-vc68**. It retains separate `.hdr`, `.img` and `.lbl`
files. The [ESA conversion](https://esdcdoi.esac.esa.int/doi/html/data/planetary/GIOTTO/GIO-C-HMC-3-RDR-HALLEY.html)
has DOI **10.5270/esa-s11mti2**. The two downloaded copies of HMC01881's image
are byte-identical; SBN additionally exposes its original FITS header beside
the image. The converted ESA data directory's detached label alone does not
contain that header's pointing and ephemeris fields.

The decoder follows the
[HMC guide](https://pdssbn.astro.umd.edu/holdings/gio-c-hmc-3-rdr-halley-v1.0/data/hmcguide.doc):

- Signed big-endian 16-bit raster, with dimensions cross-checked between FITS
  and PDS. The separate image file starts with pixels, not a FITS header.
- Only the declared raster is decoded. Its final 2,880-byte FITS block contains
  zero padding, which must not become extra image rows.
- Stored value **−32768** is missing. Zero and negative measurements remain
  valid and retain their sign. This validity describes the raster, not surface
  coverage on Halley's nucleus.
- Clear-filter samples are divided by **10** to recover **mW m⁻² sr⁻¹**,
  following Table III. The generic PDS scaling factor of one does not encode
  this physical-unit conversion.
- The first stored row is the bottom of the display. No other rotation,
  reflection, warping, sharpening or deconvolution is applied.
- These archive images already underwent geometric correction and bilinear
  interpolation. The generic ESA label's “no resampling” processing-level
  description must not override the product-specific reduction guide.

The local contact sheet enlarges native pixels four times using nearest-neighbor
sampling and uses each frame's 1st–99th percentile linear contrast stretch.
It is a display aid, not comparable albedo, true colour or recovered detail.
Blue pixels indicate the source missing-data code only. Native calibrated
arrays remain separate from that display conversion.

## Bounded frame survey

All seven retained candidates use detector **C / CLEAR**, whose `SUPERPIX`
entry is zero in these headers. The other three detector entries describe
their own formats; they must not be mistaken for detector C's sampling.

| PDS file | HMC image | Seconds before closest approach | m/pixel | Raster field, km |
| --- | ---: | ---: | ---: | ---: |
| hmc01814 | 3436 | 294.72 | 451.58 | 34.77 × 36.13 |
| hmc01838 | 3460 | 198.79 | 304.75 | 23.16 × 24.38 |
| hmc01848 | 3470 | 158.81 | 243.60 | 18.51 × 19.49 |
| hmc01856 | 3478 | 126.84 | 194.71 | 14.80 × 15.58 |
| hmc01860 | 3482 | 110.85 | 170.29 | 12.94 × 13.62 |
| hmc01869 | 3491 | 74.87 | 115.45 | 8.66 × 9.24 |
| hmc01881 | 3503 | 26.90 | 43.30 | 3.25 × 3.46 |

The field dimensions multiply the archived pixel scale by the raster size;
the valid pie-shaped footprint occupies less than that rectangle. Pixel scale
is not an independent optical-resolution measurement. Images 3460–3470 are
more useful starting points for whole-nucleus registration than the narrow
3503 frame. No numerical registration was attempted with invented parameters.

The model's documented absolute uncertainty of 0.5–1 km corresponds to
approximately **2.05–4.11 image pixels at 3470**, **4.33–8.66 at 3491**, and
**11.55–23.09 at 3503**, using each frame's archived scale. These conversions
illustrate scale mismatch. They are not fitted registration residuals, a
statistical confidence interval, or a source-supported per-pixel mask.

## What prevents a surface lens

The original headers recover scale, spacecraft spin phase, central-detector
pointing and barycentric vectors in **B1950 / EME50**. They do not supply a
rotation from the archived **Stooke body frame** into that inertial frame.
The specific shape label defines the long axis, large end, east-positive
longitude and a Vega 2 reference meridian. It attributes pointing calculations
to Alain Abergel and assumes Belton et al. (1991). That is not itself a
frame-by-frame camera solution.

The existing scene's fixed display orientation is illustrative. Substituting it
would assign real image pixels to unsupported longitudes. The inspected NASA
grant report's Belton summaries explain the tumbling interpretation but do not
provide a complete attitude/phase solution tied to the Stooke longitude origin.
The full 1991 Icarus paper was not recovered in this intake. This is a missing
binding in the evidence inspected, not a claim that a solution cannot exist.

The original images also contain dust and illumination effects. The
[instrument team's catalogue](https://www2.mps.mpg.de/en/projekte/giotto/hmc/catalog/)
distinguishes calibrated images from point-spread-function-corrected versions
and discusses dust on both sides of the nightside limb. Neither a positive
radiance threshold nor the archive's valid-pixel mask isolates surface pixels.
The published press montage and Stooke's shaded-relief drawing were therefore
not repurposed as surface photography.

A defensible continuation needs a camera/body-frame binding, validation against
independent image features or another frame, and a documented way to withhold
pixels affected by dust, limb/terminator ambiguity and registration error.
Only then can uncovered surface texels become the existing grid treatment.
No numerical coverage percentage is claimed here; `projectedSurfacePixels`
is **null**, not zero.

## Distribution status

The current ESA dataset landing page states **CC BY-NC 3.0 IGO**. The original
HMC guide separately retains MPS image copyright, permits scientific study,
and requires permission for publication/non-scientific use. This intake has
not resolved the relationship between those notices for redistributed derived
textures. It does not relicense the images as MIT or public domain.

The PR includes retrieval pins, numeric metadata, diagnostic code and this
report. Source image binaries and their image derivatives remain local under
`output/`; no imagery was uploaded to GitHub, R2 or the application. Geometry
registration is independently unresolved, so choosing a license interpretation
alone would not qualify the lens.

## Reproduce and inspect

From the comet worktree, with the repository's supported Node and dependencies:

```sh
node tools/objects/comet-1p/inspect-giotto.mjs --download
node --test tools/inspect-halley-giotto.test.mjs
```

The first command retrieves the guide plus 21 pinned frame files and writes
`output/comet-intake/halley-giotto/repro/report.json`, `contact-sheet.png`, and
seven native-size PNG quicklooks. Omit `--download` for a fully offline rerun.
`--output=directory` selects a separate acquisition/output directory. Existing
files with wrong hashes fail verification rather than being silently replaced.

Four focused tests cover signed/endian calibration, vertical orientation,
independent validity, padding, malformed metadata and pinned-cache integrity.
A separate Python/NumPy decode agreed on all seven original headers, sample
ranges, counts, display percentiles and padding sizes. The contact sheet was
visually inspected. Full `pnpm test` passes **1,788 tests**, and source
verification passes for all **76 objects**. The [validation record](evidence/halley-giotto-validation.json)
binds commands and log hashes. These checks qualify the intake decoder only.

No application, prepared asset, scene DOM or drag path changes in this intake.
There is no new performance result or new object-readiness claim; the
[existing Halley qualification](HALLEY.md) continues to describe the unchanged
historical model. PR #37 remains unmerged.
