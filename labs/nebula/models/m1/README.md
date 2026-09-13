# Crab Nebula — Alignment intake

Current Alignment selection: **all six spectral views**. Publisher coordinates
place them in the common sky frame for comparison; their independent registration
remains unverified. The earlier reference-only filter confused inspection
eligibility with processing acceptance and has been removed.

A 4096px detector trial supplied 14 Hubble/Webb pattern-confirmed matches against
the unchanged 45-match gate. That failed to certify the comparison; it did not
prove misalignment. Radio, X-ray and component-subtracted maps require suitable
astrometric evidence rather than a universal optical-star matcher. No nebular
morphology fit or expansion correction was substituted for stellar evidence.

### Webb near/mid-infrared placement check

The [compact-star diagnostic](webb-alignment-check.json), checked against
`86a6060ec`, finds **52 stellar counterparts** across all four quadrants. At the
unchanged publisher placement their RMS separation is **0.209″** (2.54 native
Webb pixels). A trial affine changes scale by only 0.019% and moves the image
centre by 0.119″; its 18 withheld fit points have 0.135″ RMS. All 52 paired native
crops were visually inspected. Shifted, mirrored, wrong-scale and rotated
placements fail the diagnostic controls. No correction was installed.

This supports the existing relative placement, with no large rotation or scale
error. It does not validate absolute astrometry: the exploratory similarity
search preceded the fit/holdout split, and Hubble supplies the sky reference.
The automatic pipeline still uses the earlier matcher, so its unverified status
is unchanged. The receipt retains source/recipe hashes, native centroids, method
settings and measured limits for replay and a later detector improvement.

Webb's footprint is tighter and the tracers differ. Compare
[ESA's own Hubble/Webb slider](https://esawebb.org/images/comparisons/weic2326a/)
before interpreting different emission boundaries as an alignment error.

Six publisher images cover optical emission lines, near/mid-infrared emission,
radio synchrotron, and the X-ray pulsar wind. They are comparison observations,
not six interchangeable measurements of one material or one epoch.

| Record | Purpose |
| --- | --- |
| [observations.json](observations.json) | Exact source pins, native dimensions, publisher WCS, shared sky frame, and registration mode. |
| [source-dossier.json](source-dossier.json) | Reader-facing coverage, epochs, wavelength and resolution caveats, and five primary research papers. |
| [intake-evidence.json](intake-evidence.json) | Native TIFF receipts, verbatim AVM fields, calculated display sampling, credits, terms, master links, and rejected alternate metadata. |

The native TIFFs and extracted metadata are cached under the ignored local M1
intake directory. Each `localCache` entry identifies the acquired file. The
largest selected file is 30.7 MB; the Webb infrared comparison uses the official
4K publication variant and links the 10509 × 9151 master. No local resizing or
cropping changed the acquired TIFFs.

The common frame is north-up, 9.1 arcminutes square. The Hubble optical mosaic is
the relative field-star reference. The Webb infrared composite requests the same
independent star check, but its publisher labels the AVM quality **Position**.
The Webb component map, Spitzer, VLA and Chandra retain **publisher WCS only**:
their nonstellar structures must not be treated as field stars or forced onto
the optical filaments. A supplied coordinate solution is not an independent
accuracy measurement.

The ESA/Hubble 2017 single-band releases were selected after their CXC alternate
TIFFs exposed inconsistent astrometry: a near-corner reference pixel and about
half the official companion field size. Both native pins are retained in the
evidence record. No guessed correction or morphology fit was applied. The
accepted releases have centred TAN metadata matching their publisher pages;
independent absolute accuracy remains unmeasured.

Crab expansion is physical. Dates in the dossier describe observations when
known, with release dates stated separately. The VLA map incorporates a historical
large-scale template; Chandra's companion release spans many pointings; the two
Webb views reuse the same observing program. A single affine transform cannot
remove spatially varying expansion or fast wisp evolution. The tight optical
and Webb mosaics do not cover the whole faint northern ejecta jet, which is
distinct from the central X-ray pulsar jet.

All selected files are 8-bit RGB presentation images. Their WCS-derived pixel
sampling is not resolution, their RGB values are not calibrated fluxes, and
black background is not an exposure or detection-limit map. The linked papers
identify calibrated archival data and the assumptions required for further
physical inference. Unknown passband, epoch, PSF and stack-membership details
remain explicitly unknown.

Intake validation checks all six downloaded byte counts, SHA-256 pins, native
dimensions, required recipe fields, dossier coverage and WCS dimensions. Visual
inspection confirmed the stated broad versus compact coverage. Alignment
preparation and browser inspection are performed by the shared lab workflow;
this intake does not claim their results. The recipe's inherited `nativeRemoval`
pins satisfy the existing schema only: no star removal, reconstruction or baking
was run for this intake.
