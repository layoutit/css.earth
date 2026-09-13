# Crab Nebula — measured ejecta and a separate pulsar wind

The local model uses **416,573 released SITELLE emission samples**, a published
Chandra torus interpretation, two finite jet approximations, and a compact light
at the pulsar's observed sky position. All six selected spectral images remain
available. These are conditional emission geometries, not recovered gas/dust
density or six interchangeable measurements of one material.

## Registered observations

| Source | Relative registration | Native treatment |
| --- | --- | --- |
| Hubble optical | Publisher sky anchor corroborated by Webb stars | Full native NOX |
| Webb infrared | 52 automatic compact-star identities; 18 held out; 0.135″ RMS | Full native NOX |
| Webb components | 70 visually established identities; 24 held out; 0.152″ RMS after explicit scale calibration | Preserve compact emission; zero residual |
| Spitzer infrared | Publisher common-grid transfer through Hubble 2017 bridge | Preserve compact emission; zero residual |
| VLA radio | Same qualified publisher-grid transfer | Preserve compact emission; zero residual |
| Chandra X-ray | Same qualified publisher-grid transfer | Preserve compact emission; zero residual |

The auxiliary Hubble 2017 image is an astrometric bridge, not a seventh lens.
Its 129 visually inspected stellar identities yield 43 held-out fit points and
0.146″ RMS. Transfer receipts pin both original grids and their identity pixel
mapping. Radio/X-ray knots never masquerade as matched field stars; those bands
report zero source matches and separate bridge counts. Publisher interband
calibration, instrumental resolution and epoch differences remain limitations.

The Webb component TIFF's native stellar scale is about 2.67% larger than its
AVM field. The [calibration](webb-components-astrometric-calibration.json) records
that correction separately; the original publisher WCS is untouched. Its
corrected width is about 5.47′, consistent with the other Webb mosaic. The
45-match, held-out residual, coverage, parity and placement gates are unchanged.
The [component](webb-components-matched-stars.json) and
[bridge](hubble-2017-bridge-matched-stars.json) identity catalogues were discovered
with model assistance and verified in paired native crops. Their held-out
residuals assess the affine fit conditional on those established identities;
they are not blind discovery tests or independent absolute catalogue astrometry.

[Native accounting](native-accounting-check.json) checks every original RGB8
value against diffuse plus residual, with maximum error zero. Hubble's 121 NOX
tiles and Webb's 110 tiles completed in 16.3 and 14.9 seconds of inference.
Central native comparisons show successful compact-star subtraction, with some
faint filament texture and halo leakage into the residual. The pulsar is restored
as a separate observed-position light. Preserved component/radio/X-ray maps may
retain foreground stars; preservation is not a stellar membership decision.

## Physical inputs and coordinate qualification

[Physical sources](physical-sources.json) pins ten retrieved primary papers,
source arrays, complete inspected FITS headers and catalogue astrometry.
[The evidence ledger](physical-evidence.json) separates observations, published
model inferences and authored display assumptions. The executable choices are
in [sampled.json](sampled.json); the general compiler owns the algorithms.

The released dataset is Thomas Martin's
[M1_paper repository at the pinned commit](https://github.com/thomasorb/M1_paper/tree/af491d4a13d408464ffb3ea75e6a424f6ef5d140),
which carries **GPL-3.0**. Its licence is preserved and hashed. The FITS data are
not labelled NASA/public domain; large originals, PDFs and derived rasters stay
in the ignored local cache. No upstream notebook implementation was copied.

The 2016 November SN3 observations cover an 11′ field in Hα, [N II] and [S II],
with 0.32″ sampling and measured seeing FWHM 1.17 ± 0.04″. Flux and velocity
tables contain bit-identical XYZ columns. Their fourth columns contain emission
weight and radial velocity respectively. The released headers omit coordinate
units/origin, per-row errors and velocity-frame metadata. Therefore raw XYZ was
not blindly interpreted as parsecs.

Raw XY was mapped onto the accompanying native deep image using the exact
regular point spacing and four independent emission regions. All regional
translations agree within one native pixel. Deep-image stellar registration
then places this internal grid in the common Hubble sky frame; its exploratory
59-match fit has 20 held-out points and 0.167″ RMS. Paired native crops were
inspected where the full crop fits. This internal line/deep correspondence is
dataset-coordinate qualification, not independent morphology or depth evidence.
The transport receipt and approximate 0.4″ local uncertainty are retained.

The common axes are west, north and **away from Earth**. The paired velocity
column establishes `velocity = −1116.00116 × rawZ` km/s. Depth follows the
published conditional expansion rate 0.00116 ± 0.000015 yr⁻¹ at 2 kpc; the
12-coefficient affine in the recipe makes this conversion reproducible.
Nonuniform acceleration means this is not a unique dynamical reconstruction.
The newer northern [O III] ejecta-jet observations are documented but their
arrays were not acquired, and that faint jet is not invented outside coverage.

## Pulsar wind, dust and spectral limitations

The selected Ng & Romani torus pair has inner radius 15.60″, axis PA 124.0°,
inclination 61.3°, and outer radius 41.33″, PA 126.31°, inclination 63.03°.
The authors fixed Gaussian widths at 3″ and 5.9″. The alternative offset inner
ring from Weisskopf et al. is retained in the ledger and is not averaged into
this choice. Jet lengths, widths, relative strengths and pulsar depth/size are
explicit display assumptions. The pulsar's catalogue ICRS position and proper
motion remain separate from its authored in-cloud depth.

The sampled ejecta and analytic wind occupy the same angular frame. Each lens
weights those fixed components by tracer: Chandra uses the inner wind, while
optical filaments primarily use ejecta. The neutral view shows their union.
This does not force X-ray brightness across the outer optical cloud. There is
no separate extended radio synchrotron volume, relativistic beaming, time
variation, dust absorption/scattering, or calibrated radiative transfer. Warm
JWST dust components trace filament cores; presentation colours do not measure
mass, opacity or density. Epochs remain distinct rather than rescaling evolving
filaments and wisps to coincide.

The 256-cell grid has approximately 1.4″ cells and Gaussian sigma 0.5 cell;
its effective smoothing remains coarser than the measured seeing. RGB,
component strengths and peak optical depth are display parameters. Native image
pixel sampling is not instrumental resolution, and black display pixels are
not exposure masks. The selected optical/Webb footprints are tighter than the
full faint remnant.

[compiler.json](compiler.json) and
[observation-structures.json](observation-structures.json) reproduce the source
and analysis stages through the shared lab commands. Shifted, mirrored and
wrong-scale stellar controls fail; deleting the explicit Webb calibration
restores the original failed plausibility gate. The 17 affected registration,
source-treatment and catalogue tests, plus the lab TypeScript check, passed.
The [processing receipt](processing-evidence.json) pins the completed six-lens
volume and actual camera inspection. All lenses, the compact pulsar, original
overlays and refresh work without reprocessing. **Immediate presentation remains
unresolved:** newly painted CSS layers can take several seconds to settle after
a material or camera change. Settled oblique views retain the ejecta; the initial
dark captures did not establish a permanently disappearing volume. Keeping URL
image decoders alive regressed decoding under load, so the working closeable
bitmap validation remains. No exposure or geometry workaround was applied.

The displayed Hubble comparison also misses about 68% of target light because the released line
samples and selected inner wind do not model the complete diffuse continuum.
Neither passing browser interactions nor this unfitted comparison validates the
physical reconstruction.
