# Crab Nebula: measured ejecta and a separate pulsar wind

This lab model holds processing studies for the Crab Nebula. The
[current shipped object record](../README.md) owns
the active sources, delivery evidence and known problems. Experiments here do
not qualify later deliveries.

**Material quality remains blocked.** The live bake has finite 3D density but
repeats photographic color through depth. The replacement material path removes
that operation, yet the [bounded trials](material-trial.json) lose front detail
or produce colored beads. None was promoted. The next model step is connected
filament/ridge support, followed by the depth-aware RGB fit; adding more isolated
Gaussian blobs or restoring XY projection is not an accepted correction.

The model uses **416,573 released SITELLE emission samples**, a published
Chandra torus interpretation, two finite jet approximations, and a compact light
at the pulsar's observed sky position, across six spectral images. These are
conditional emission geometries, not recovered gas/dust density or six
interchangeable measurements of one material. A diffuse-emission extension adds
an image-fitted interior proxy: Hubble, both Webb views, Spitzer and VLA fit
separate amplitudes, while Chandra keeps the inner-wind geometry and strengths.

## Registered observations

| Source | Relative registration | Native treatment |
| --- | --- | --- |
| Hubble optical | Publisher sky anchor corroborated by Webb stars | Full native NOX |
| Webb infrared | 52 automatic compact-star identities; 18 held out; 0.135″ RMS | Full native NOX |
| Webb components | 70 visually established identities; 24 held out; 0.152″ RMS after explicit scale calibration | Preserve compact emission; zero residual |
| Spitzer infrared | Publisher common-grid transfer through Hubble 2017 bridge | Preserve compact emission; zero residual |
| VLA radio | Same qualified publisher-grid transfer | Preserve compact emission; zero residual |
| Chandra X-ray | Same qualified publisher-grid transfer | Preserve compact emission; zero residual |

The auxiliary Hubble 2017 image is an astrometric bridge, not a seventh dataset,
with 43 held-out fit points and 0.146″ RMS. Radio and X-ray knots are never
matched as field stars. Publisher interband calibration, instrumental resolution
and epoch differences remain limitations.

The Webb component TIFF's native stellar scale is about 2.67% larger than its
AVM field. The [calibration](webb-components-astrometric-calibration.json) records
that correction separately; the publisher WCS is untouched. The
[component](webb-components-matched-stars.json) and
[bridge](hubble-2017-bridge-matched-stars.json) identity catalogues were found
with model assistance and verified in paired native crops. Their held-out
residuals test the affine fit given those identities; they are not blind
discovery tests or absolute catalogue astrometry.

[Native accounting](native-accounting-check.json) checks every original RGB8
value against diffuse plus residual, with maximum error zero. Compact stars are
subtracted, with some faint filament texture and halo leaking into the residual.
Preserved component, radio and X-ray maps may keep foreground stars.

## Physical inputs and coordinates

[Physical sources](physical-sources.json) pins ten primary papers, source arrays,
FITS headers and catalogue astrometry. [The evidence ledger](physical-evidence.json)
separates observations, published model inferences and authored display
assumptions. The executable choices are in [sampled.json](sampled.json); the
general compiler owns the algorithms.

The released dataset is Thomas Martin's
[M1_paper repository at the pinned commit](https://github.com/thomasorb/M1_paper/tree/af491d4a13d408464ffb3ea75e6a424f6ef5d140),
which carries **GPL-3.0**. Its licence is preserved. The FITS data are not
labelled NASA/public domain; large originals, PDFs and derived rasters stay in
the ignored local cache. No upstream notebook code was copied.

The 2016 November SN3 observations cover an 11′ field in Hα, [N II] and [S II],
with 0.32″ sampling and seeing FWHM 1.17 ± 0.04″. The released headers omit
coordinate units, per-row errors and velocity-frame metadata, so raw XYZ is not
read as parsecs. Raw XY is mapped onto the accompanying deep image, which stellar
registration places in the common Hubble sky frame (20 held-out points, 0.167″
RMS, about 0.4″ local uncertainty).

The common axes are west, north and **away from Earth**. The velocity column gives
`velocity = −1116.00116 × rawZ` km/s. Depth follows the published conditional
expansion rate 0.00116 ± 0.000015 yr⁻¹ at 2 kpc. Nonuniform acceleration means
this is not a unique dynamical reconstruction. The northern [O III] ejecta-jet
arrays were not acquired, and that jet is not invented.

## Pulsar wind, dust and spectral limits

The Ng & Romani torus pair has inner radius 15.60″, axis PA 124.0°, inclination
61.3°, and outer radius 41.33″, PA 126.31°, inclination 63.03°, with Gaussian
widths fixed at 3″ and 5.9″. The alternative ring from Weisskopf et al. stays in
the ledger. Jet lengths, widths, strengths and pulsar depth/size are display
assumptions.

Each dataset weights the ejecta and wind by tracer: Chandra uses the inner wind,
optical filaments mainly the ejecta. There is no calibrated radio synchrotron
volume, beaming, time variation, dust absorption or radiative transfer. JWST dust
colors do not measure mass, opacity or density.

The 256-cell grid has about 1.4″ cells and Gaussian sigma 0.5 cell, coarser than
the seeing. RGB, component strengths and peak optical depth are display
parameters. The optical and Webb footprints are tighter than the full faint remnant.

[compiler.json](compiler.json) and
[observation-structures.json](observation-structures.json) reproduce the source
and analysis stages through the shared lab commands. The
[processing evidence](processing-evidence.json) records the six-dataset volume
and its visual limits. Newly painted CSS layers can take several seconds to
settle after a material or camera change.

## Fitting the missing interior light

The optional [sampled emission fit](../../../../labs/nebula/docs/sampled-volumes.md) fits one
filament brightness gain plus nonnegative coefficients on 143 fixed 3D Gaussian
atoms (20″ sigma, 36″ spacing) inside an authored envelope of 185″/135″/135″
centred on the pulsar. Every seventh image pixel is withheld to test interpolation.

[Temim et al. §6.1](https://arxiv.org/pdf/2406.00172v1) describe a synchrotron
nebula of about 7.6′ × 5.5′, larger than our field. The new component is
therefore **inferred diffuse emission / a continuum proxy**, not identified
synchrotron, and its envelope is authored. [Dubner et al.](https://arxiv.org/pdf/1704.02968v1)
show that radio, optical/IR and X-ray nebulae differ, so their fitted maps stay
separate.

The fit reduces missing Hubble display light from 72.5% to 22.2% and Webb
infrared from 71.2% to about 19.3%, with about 7% excess light in both. All five
fitted datasets improve withheld-pixel error. The inferred glow stays broad from
oblique views, and faint RGBA8 contours remain visible.
