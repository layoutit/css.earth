# Iapetus: B9 source qualification and intake history

Reviewed 2026-09-09. **Source qualification and preparation are complete for
partial infrared RGB and water-ice absorption views.** The final cohort is
1568129671_1, 1568133146_2 and 1568157352_4; both maps cover about 23.4% of the
reference sphere's solid angle. Exact-USGS comparison supports gross framing,
while precise local absolute registration remains unqualified. Existing geometry
and scene behavior remain fixed. See the [B9 README](../README.md) for the final
products and separate mounted-view review.

The initial intake below read metadata and at most the first 65,536 bytes of
each cube. Its header-only receipts and candidate assessments are historical;
the final source audits near the end of this document supersede those limits.

## Initial source selection

The first bounded decode selected the two pairs below. All dates are 2007-09-10
UTC. Geometry ranges are the Nantes page summaries, rounded by that service;
they are not per-pixel acceptance counts. The wider third observation,
[1568157352_4](https://vims.univ-nantes.fr/cube/1568157352_4), was selected after
this initial review and contributes to both final maps.

| Cube | Mid-time; native IR dimensions | Page geometry | Disposition |
| --- | --- | --- | --- |
| [1568129671_1](https://vims.univ-nantes.fr/cube/1568129671_1) | 15:01:14; 40 × 40; 120 ms/pixel; NORMAL | Approximately 3 km/pixel; phase 19°; incidence 15–51°; emission 26–47°; no limb | First candidate: independently published observation of a sharp bright/dark terrain boundary. |
| [1568133146_2](https://vims.univ-nantes.fr/cube/1568133146_2) | 15:58:25; 26 × 26; 160 ms/pixel; NORMAL | Approximately 7 km/pixel; phase 28°; incidence 9–31°; emission 33–53°; no limb | Second candidate: complementary footprint subject to actual navigation/overlap review. |

The exact original download links and header-declared extents are:

| File | Download | Last byte declared by header |
| --- | --- | ---: |
| C1568129671_1_ir.cub | [Nantes calibrated IR](https://vims.univ-nantes.fr/cube/C1568129671_1_ir.cub) | 1,911,053 |
| N1568129671_1_ir.cub | [Nantes IR navigation](https://vims.univ-nantes.fr/cube/N1568129671_1_ir.cub) | 310,986 |
| C1568133146_2_ir.cub | [Nantes calibrated IR](https://vims.univ-nantes.fr/cube/C1568133146_2_ir.cub) | 904,329 |
| N1568133146_2_ir.cub | [Nantes IR navigation](https://vims.univ-nantes.fr/cube/N1568133146_2_ir.cub) | 228,262 |

These sum to 3,354,630 bytes of declared file extent. At intake, GET and HEAD
returned no Content-Length; C/N GET ignored Range and returned 200. The client
stopped each read at 64 KiB. The hashes in [the intake receipt](iapetus/intake.json)
and [header receipts](iapetus/header-receipts.json) therefore identify
prefixes/labels only, never full products. Subsequent complete acquisitions
recorded actual lengths and full SHA-256s; all three final C/N pairs and matching
QUBs are pinned beside the body in `source/cassini-ice` and `source/manifest.json`.

The PDS labels independently match target, acquisition times and dimensions:

- [v1568129671_1.lbl](https://planetarydata.jpl.nasa.gov/img/data/cassini/cassini_orbiter/covims_0022/data/2007253T132021_2007253T162817/v1568129671_1.lbl); raw QUB declared size 1,233,408 bytes.
- [v1568133146_2.lbl](https://planetarydata.jpl.nasa.gov/img/data/cassini/cassini_orbiter/covims_0022/data/2007253T132021_2007253T162817/v1568133146_2.lbl); raw QUB declared size 547,840 bytes.

The initial intake did not download the raw QUBs. The final pipeline uses the
complete originals to check detector saturation, background and archive-filter
dependencies. It does not recalibrate them or substitute them for the selected
calibrated C values. The label-declared QUB extents above are historical metadata,
not a substitute for the final measured-file receipts.

## Quantities, calibration and selected bands

Both C headers declare 256 IR bands, little-endian float32, unit base/multiplier 0/1, one native-size tile per band, core starting at byte 65,537, target IAPETUS, IR channel, RC19 calibration and I/F output. Read `BandBin.Center`, not `MissionAverage`, and validate the corresponding `OriginalBand` entries. The actual centers below match in both cubes.

| Use | One-based IR band | Original 352-band number | Center (µm) |
| --- | ---: | ---: | ---: |
| RGB red; absorption measurement | 70 | 166 | 2.02129 |
| RGB green | 44 | 140 | 1.59305 |
| RGB blue | 25 | 121 | 1.28142 |
| Absorption left continuum | 58 | 154 | 1.82362 |
| Absorption right continuum | 81 | 177 | 2.20310 |

This RGB channel choice follows the independent infrared figure in [Tosi et al., 2010](https://arxiv.org/html/0902.3591v4#S4), using current released centers rather than reproducing that paper's older RC15/RC17 calibration. The paper selects the first cube specifically for its bright/dark boundary and spatial/signal/phase tradeoff. Its native image provides an independent boundary-pattern reference; it is not a georeferenced control network.

The implemented absorption quantity is `D = 1 − I/F(2.02129) / Rc`, with `Rc`
linearly interpolated between the two listed continuum samples at the middle
wavelength. It is a dimensionless **2.02 µm water-ice absorption index**: a
fixed-channel observation index, not a fitted band minimum, ice fraction, grain
size or temperature. Finite negative depths are retained. RGB uses fixed
documented display ranges; it is false color, not human-visible color.

The [Nantes pipeline](https://vims.univ-nantes.fr/info/isis-calibration) uses ISIS
3.5.2 and radiometric calibration, followed for these dimensions by a 5 × 5 noise
filter and 3 × 3 replacement of rejected NULL samples. Source values therefore
already include spatial filtering. It supplies no Iapetus photometric
normalization. Do not describe the derived maps as raw, unsmoothed or corrected
normal reflectance. Complete per-file processing histories lie after the core;
they were unread at the header-only stage and checked during final source
qualification.

Portal preview wavelengths differ from calibrated centers: for example original band 164 is 1.98834 µm here, and original band 230 is 3.08463 µm. Do not select channels by copying preview captions.

## Missing observations and navigation policy

The converter applies [ISIS Real special-pixel semantics](https://isis.astrogeology.usgs.gov/3.9.0/Object/Programmer/_special_pixel_8h.html): NULL and low/high instrument/representation saturation are the float32 bit patterns `0xff7ffffb` through `0xff7fffff`; minimum valid is `0xff7ffffa` interpreted as float32. It requires finite values at or above that minimum in **every contributing band**, not just in the first IR channel. Valid zero or negative calibrated noise is not automatically missing. The absorption continuum must additionally be positive and finite; a zero center measurement can remain valid. The preparation receipt records exclusions separately, including the original-detector quality checks.

Each N cube matches its C cube's dimensions and instrument identity. Its six named planes are phase, emission, incidence, latitude, longitude and pixel resolution. In [the matching ISIS 3.5 documentation](https://isis.astrogeology.usgs.gov/3.5.0/Application/presentation/Tabbed/phocube/phocube.html), camera geometry uses planetocentric latitude and east-positive 0–360° longitude; angles are degrees and pixel resolution is meters. The N `BandBin.Center`/I/F calibration fields are inherited spectral metadata, not navigation units. Off-body pixels are NULL, and Nantes explicitly withholds unresolved limb geometry.

The final recipe records conservative geometry cuts: incidence/emission below
70°, phase 10–120°, resolution below 40 km/pixel, and valid navigation/continuum.
These are presentation choices, not Iapetus-derived photometric coefficients.
The mapper uses supported native detector apertures, withholds uncertain edges
and preserves genuine low-albedo terrain. It assigns one deterministic source
owner without averaging spectra or bridging unsupported gaps. The numerical
source maps distinguish valid dark samples from nodata, and receipts retain
accepted/rejected counts, overlaps and reference-sphere coverage.

## Registration to the existing Iapetus surface

Both labels identify reconstructed pointing `07252_07257ra.bc`, `cas_v40_usgs.tf`, spacecraft position `180628RU_SCPSE_07221_07262.bsp`, and Iapetus body frame 10046. The source navigation ellipsoid is 747.4 × 747.4 × 712.4 km; no detailed shape model is attached. Transfer its planetocentric directions onto the fixed existing geometry. The package's USGS monochrome source is east-positive/planetocentric with central longitude 0 and reference radius 736 km; PIA18436 uses central longitude 180. Neither central longitude is an instruction to rotate N longitudes.

The first cube's source subspacecraft point is approximately 11°S, 129°E; the second is 11°S, 117°E. **These are spacecraft footprint context, not measured centers of their cropped surface footprints.** They must not become public focus coordinates without decoding N.

The published native RGB independently supports observation identity and the
first cube's bright/dark pattern. The subsequent
[exact-USGS comparison](iapetus/iss-framing.md) supports gross longitude and
latitude framing for all three selected observations. It does not measure a
precise local registration residual. A native-center holdout measures
interpolation stability only. Ridge relief, source ellipsoid and pointing
differences retain an explicit approximate-registration limit; exact or subpixel
registration is unproven.

## Complementary and corrected sources

| Candidate | Added value and disposition |
| --- | --- |
| [Pinilla-Alonso et al., 2011 VIMS mosaic](https://www.sciencedirect.com/science/article/abs/pii/S0019103511002661), also used by [Dalle Ore et al., 2012](https://doi.org/10.1016/j.icarus.2012.09.010) | Promising broader spectral mosaic with post-encounter pointing. Public numerical mosaic, exact processing and reuse pins remain unresolved; papers/figures do not constitute those inputs. Do not claim it is unavailable. |
| [Clark et al., 2012 composition mapping](https://doi.org/10.1016/j.icarus.2012.01.008) | More extensive interpreted composition maps. Numerical mapped release unresolved in this pass; material inversions would need their own semantics and uncertainties. |
| [Blackburn et al., 2011 bolometric albedo](https://doi.org/10.1016/j.icarus.2010.12.022); [earlier method description](https://www.lpi.usra.edu/meetings/lpsc2010/pdf/1242.pdf) | Corrected normal-reflectance/Bond-albedo work, but a different quantity. The final paper mirrors northern values into the south and extrapolates other gaps. Excluded as an observed ice-coverage substitute; numeric release also unresolved. |
| [Filacchione et al., 2022 spectrophotometric maps](https://arxiv.org/abs/2111.15541) | Useful corrected-source precedent for Tethys and four other regular moons; its mapped cohort excludes Iapetus. Do not transfer another moon's correction coefficients. |

Incoming cube 1568124800_1 was excluded from the initial selection: phase 129°
and incidence 72–76°. The gallery also lists 1536452322_1, actually acquired in
2006; gallery/flyby membership alone is not an acquisition filter. The subsequent
selection added the wider REGMAPTRL observation 1568157352_4 after inspecting
the initial pair's native footprint and scan gaps. The other numerical-map
alternatives above remain separate unresolved source candidates.

## Subsequent numerical and detector review

The [independent validation report](iapetus/independent-validation.md) records
complete-file hashes, actual selected-band values, all 2,276 initial camera-center
comparisons and the scan-gap/aperture findings. It supersedes the metadata-stage
full-file and signal checks. Adjacent image centers cannot be treated as
continuous surface coverage. The final
[detector-aperture audit](iapetus/rasterizer-review.md) and
[USGS framing review](iapetus/iss-framing.md) record qualified nominal physical
support and gross framing, with the sampled-motion and absolute-registration
limits stated explicitly.

## Reuse and final scope

The [Nantes data policy](https://vims.univ-nantes.fr/about) explicitly licenses all distributed data CC BY 4.0. Required credit: NASA/Caltech-JPL/University of Arizona/Osuna-CNRS-Nantes Université; acknowledge processing modifications and cite Brown et al. (2004) and Le Mouélic et al. (2019). This conclusion uses the data policy, not just the preview-image caption.

The selected complete-file, signal, detector-quality, source-support and gross
framing checks are complete; the final three-observation products remain
partial maps, not global coverage or precision absolute registration. Mounted
review and delivery are recorded separately from this source review in the
[B9 documentation](../README.md).

Historical resource note: the initial intake retained under 1.1 MiB of metadata
and headers before small documentation copies, with no numerical processing,
build, browser, installation or source-package edit. Subsequent full acquisition,
source conversion and independent audits are recorded in their own receipts.
