# Qualified spatial samples and separate emitting components

Crab uses the existing compiler workspace and PolyCSS volume renderer with a
different offline support operator. The image-fitting compiler remains unchanged
for Pleiades, Lagoon and the earlier experiments.

## What establishes the shape

1. An object recipe pins a released FITS point table, dimensions, column meanings,
   evidence ledger and a qualified affine transform into **west, north, away**
   arcseconds. A FITS array without units or WCS is not automatically a parsec map.
2. Positive line-emission samples are splatted into a bounded 3D grid. Full sample
   extent and finite kernel padding are retained. Flux exponent, smoothing and
   display exposure are authored settings, distinct from instrumental resolution.
3. Analytic torus, finite jet and ellipsoid terms form a separate component field.
   Every term cites observations, published models or explicitly authored choices.
   These terms do not move or replace the spatial sample array.
4. Each registered image names its component weights. An optional `emissionFit`
   fits one ejecta amplitude and a separate diffuse field per selected source.
   Finite spherical Gaussian atoms occupy a fixed, tilted 3D envelope established
   before reading images. Their centers, widths and depths never follow image
   brightness. Positive coefficients add inferred light without moving samples.
   Sources omitted from this fit retain their original mixture; Crab's Chandra
   wind therefore stays separate from its optical/infrared diffuse proxy.
5. The baker prepares XYZ slabs in one unchanged angular frame. Within a mixture,
   RGB lenses retain identical alpha. Between different tracers, component opacity
   intentionally differs. Lens switching performs no fitting or baking.

All displayed banks, including neutral, use one retained mesh. Preparation unions
their actual nonempty raster footprints, because RGBA8 quantization can extend a
weaker component one pixel past the neutral crop. It translates each original
RGBA raster onto that integer pixel grid and pads missing areas/slices with zero.
No source pixel is resampled or clipped. A real max-alpha union defines mesh
occupancy only; each displayed bank keeps its own original opacity and a pinned
alpha digest. Both server and viewer reject mismatched positions, crops or slabs.

No source photograph is extruded. Depth/fit sliders are unavailable for this
operator because the generic image-fit controls cannot validly modify its
qualified coordinates. Material, original-image, star and camera controls remain
available. Changing the spatial model requires its object recipe and a new bake.

## Fit the remaining image emission

The optional recipe pins source and evidence IDs, envelope position/orientation,
three semi-axes, atom width/spacing, sampling, regularization, iteration limit and
coefficient limits. Candidate-count guards reject unsupported envelopes before
enumeration. Every finite kernel must fit inside the inspected physical bounds.

The forward fit combines the unchanged ejecta projection, fixed inner-wind
projection and analytically integrated 3D atoms. Nonnegative coefficients minimize
regularized disagreement with the registered starless image's display opacity.
The target uses peak RGB because the retained material normalizes chromaticity;
diagnostic panels include that material's luminance rather than comparing a white
opacity map with a colored image. No photograph is normalized along individual
depth rays or repeated into a volume. Missing source coverage remains excluded.

Every seventh pixel is withheld from fitting. Receipts retain before/after and
withheld-pixel errors, missing/excess signal, fitted amplitudes and every atom.
These are interpolation and display checks, not independent depth validation or
calibrated flux. Different tracers fit independently; a generic RGB residual
cannot identify synchrotron separately from dust, lines or processing artifacts.

After fitting, atoms are sampled once into ordinary float grids; the existing
XYZ baker and retained renderer consume the result. Original ejecta/wind arrays,
astrometry, velocities and the existing star catalogue remain unchanged. The
neutral view includes the reference lens's fitted diffuse field. Grid and fit
receipts are hashed and checked alongside the base model before cached reuse.

## Registration and compact emission

Stellar bands use verified native star correspondences. Sparse compact-source
detection avoids promoting coloured filaments to stars. A documented common
publisher grid can transfer registration through a directly star-verified optical
bridge; that transfer has **zero independent stellar matches in the nonstellar
band**. Its receipt identifies the bridge, source hashes, pixel mapping and limits.

Maps dominated by synchrotron or X-ray structure use explicit preservation:
original equals diffuse; extracted stellar residual equals zero. This is not a
claim that neural star removal succeeded. Optical/compatible infrared images still
use native NOX and its exact additive accounting checks.

A named compact central source is separate from cloud emission and generic field
lights. Its position and uncertainty come from the object record; angular marker
size and exposure remain display choices. No invented pulsation, moving wisps or
time evolution is rendered. Image residuals only give relative display photometry,
not measured luminosity, distance or membership.

## Reproducibility and interpretation

The compiler hashes source images, qualified samples, recipes, evidence and both
shared/compiler-specific TypeScript owners. It writes float grids, model and method
snapshots, spectral banks and comparison panels to the ignored local cache.
Local publication pins those inputs before the browser loads a result.
On opening the workspace, a currently validated CLI bake supersedes a historical
completed job only when its controls, evidence settings and registration match.
Saved job history and active work remain intact; loading never starts a new bake.

The diagnostic source/projection residual is a comparison of stretched display
images. It is not a calibrated line-flux residual or evidence that inferred depth is
correct. Spectral epochs, velocity frame, expansion-law assumptions, unobserved
tracers, missing uncertainties and front/back ambiguity remain in the object ledger.

See [Crab's source and evidence record](../models/m1/README.md). Its fitted diffuse
interior is a bounded continuum proxy, not the complete extended PWN. Missing
outer coverage, scattering, absorption and Doppler boosting remain unresolved.
