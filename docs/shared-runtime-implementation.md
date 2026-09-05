# Shared object runtime implementation

PR #2 now uses data-only prepared presentations for all eleven registered objects.
The shared runtime builds each retained scene, resolves selection and material
demand, publishes materials, and owns camera, resources, playback and cleanup.
Packages contain source inputs, offline preparation, generated records and actual
control content. No package presentation executor remains in the runtime closure.

The source architecture passes its current strict audits. The final combined
acquisition, test, build, real-Chrome, visual and payload checks are still pending;
this document does not declare the final PR head ready to merge.

## Runtime and preparation changes

[`object-runtime.mjs`](../src/platform/object-runtime.mjs) assembles one lifetime,
control binding, resource owner, playback owner, selection owner and orbit binding.
The router supplies playback permission. Every client is an imports-only binding
to this factory, and every definition binds `cssearth-object-runtime@2` to a
validated `PREPARED_PRESENTATION` and its actual control export.

[`prepared-presentation.mjs`](../src/platform/prepared-presentation.mjs) is the
single scene builder and selection-write interpreter. Offline preparation emits
final retained node records, source-derived styles, asset references and exhaustive
lens/toggle variants. Runtime nodes reference a shared style-property dictionary.
Assignments remain ordered after the initial `cssText`; this preserves the native
CSS parsing behavior of the prepared matrix strings while avoiding repeated
property payloads.

[`prepared-material.mjs`](../src/platform/prepared-material.mjs) publishes every
dynamic material track. It selects a prepared frame and address, applies the
configured fallback, and transports the view-dependent rotation. The companion
[demand interpreter](../src/platform/prepared-material-demand.mjs) handles current,
visible, directional and neighboring-row policies from records. Objects may have
zero, one or multiple tracks without adding a publisher implementation.

The shared resource owners protect the committed working set while a replacement
decodes. Pools declare capacity, concurrency, stability delay, retention and native
slot reuse. Cancellation, retry, URL coalescing, lease release and eviction stay in
the common implementation. A selection resolves all required texture writes before
publishing any of them. Native body-layer registrations verify the retained scene
relationship at the publication boundary.

Earth's optional destination catalog, page layers, motion-frame indices and
navigation bounds use the same shared navigation and prepared-map owners. These
are optional data fields in the contract, with no Earth-ID branch in the runtime.

Saturn's normal preparation retains the encoded ring, shadow and motion images
produced by its source recipe. Those images also feed later material preparation,
which consumes RGB beneath transparent texels. Re-optimizing them changed both
the accepted asset bytes and derived foreground-ring colors. The extra Saturn
optimization step is removed. The shared lossless optimizer used elsewhere now
preserves and verifies all RGBA bytes; this does not authorize re-encoding an
already accepted runtime asset. Neptune's six default material images are terminal
display outputs; its later orbit rasters use fresh raw material buffers. They use
the explicit shared display-lossless policy, which retains the original encoded
bytes and verifies visible RGB and alpha. Both Neptune moon atlases retain full
RGBA optimization. The actual eight-input regression matches all accepted hashes.

## Selection and projection corrections

Saturn now has one selected lens. Cross-section is exclusive, re-clicking it is
idempotent, and an exterior lens exits it. Rings and Shadows remain independent
settings. Delayed, failed and cancelled transitions preserve the committed lens;
there is no separate interior flag or remembered exterior selection.

Saturn's ellipsoid inputs are prepared offline. The shared
[ellipsoid helper](../src/platform/prepared-ellipsoid-projection.mjs) receives radii,
static matrices, centering, coverage, material dimensions and the current view.
It returns the affine material transform without reading the DOM or deriving
scene geometry. The same helper accepts sphere, oblate and prolate parameters.
The two material tracks use its prepared projection data; there is no Saturn
publisher branch.

Prepared numeric-transport fields preserve the accepted native CSS transform
precision, including fractional truncation and significant-digit serialization.
They describe the transport, not an object ID. The source-bound fixture contains
96 independently captured native camera/roll poses; the shared helper matches
all raw transform strings. A separate analytic test covers 900 parameterized
ellipsoid supports. These prove the scoped projection behavior, not full-scene
pixel parity or final browser ownership.

## Atmosphere and material ranges

Earth and Mars call the common offline `prepareAtmosphereFrame` integrator with
different source profiles. Earth's profile contains Rayleigh and Mie layers,
source light intensity and recorded camera exposure/opacity response. Mars uses
an isotropic exponential shell calibrated to its source limb color and opacity.
Their source/model conversion stays under each package's preparation tools.

Earth retains separate lighting and atmosphere tracks. Mars uses one composite
track with 512 prepared addresses: the directional frame selects one of 256
phases, and the Shadows variant supplies `frameOffset: 0` or `256`. Both ranges
include directional atmosphere. `publishWithAddress` keeps light rotation tied
to an available address; it prevents a pending material from advancing its
rotation independently. The same shared material publisher handles both objects.
Fresh regeneration, provenance verification and final visual qualification of
these integrated atmosphere changes remain pending.

## Production data closure

Uranus and Neptune control modules now import small generated lens-control records
instead of material-bearing `preparedLenses.mjs` modules. The existing scene
preparation chain generates these records offline. The actual `objectControls`
objects compare deeply equal before and after, preserving labels, descriptions,
titles and defaults, including shared shell title imports.

The imported generated modules shrink from 146,828 to 753 bytes for Uranus and
145,284 to 670 bytes for Neptune: 290,689 raw bytes removed from those imports.
The production client closures no longer reach either large lens module. This
is a source-payload measurement; final compressed-bundle, transfer and performance
measurements are pending.

## Validation status

The current source ownership and prepared-presentation audits pass for all eleven
objects, with no private owner or shared object-ID dispatch violations. Their 41
focused regression tests pass. Earlier focused checks also passed 64 Saturn tests,
five shared ellipsoid tests and 31 Uranus/Neptune checks; the scope and limitations
are recorded in [the proof](generic-runtime-contract-proof.md).

Earlier visual captures retain unresolved strict pixel differences. Diagnostic
repeatability and successful focused tests do not convert those failures into a
pass. Final source hashes, prepared-asset receipts, aggregate gates, native-owner
observations, matched DPR 1/2 renders and payload/performance results must be bound
to the final integrated source. The [adapter data inventory](shared-runtime-architecture-proposal.md#remaining-adapter-differences-are-data)
describes the remaining differences without assigning execution back to packages.
