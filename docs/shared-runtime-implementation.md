# Shared object runtime implementation

PR #2 now uses data-only prepared presentations for all eleven registered objects.
The shared runtime builds each retained scene, resolves selection and material
demand, publishes materials, and owns camera, resources, playback and cleanup.
Packages contain source inputs, offline preparation, generated records and actual
control content. No package presentation executor remains in the runtime closure.

The recorded source architecture passes its strict audits. Native Chrome instrumentation
also passed all eleven objects at DPR 1 and 2: one actual camera per scene and
the shared publication path for every observed material target. Final integration,
aggregate tests and visual qualification remain separate; the PR is not declared
ready to merge by these ownership results.

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
publishing any of them.

Mercury's perspective camera rides the same data runtime. Its prepared
presentation declares three view bindings the interpreter transports from the
camera's publication: a `silhouette-fit` transform for the lighting overlay
(the projected silhouette ellipse, floored to the far-view marker), the
`level-of-detail-stage` attribute on the stage and a `view-property` for the
billboard disc's opacity. Its lighting track names a `farBank`: past the
geometry stage the publisher draws the same frame from the one-row billboard
atlas, so the demand interpreter stops requesting row shards. The optional
`heliocentricView` record (the Sun as geometry, the orbit, the planetary
system's markers and captions) is validated with the presentation and mounted
by the shared runtime beside the retained tree.

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

Saturn's base phase now generates its normal material masters once and records
their source and output hashes using the shared preparation receipt. Final
`--compose` verifies that receipt and combines the prepared lens outputs. It
fails if the base data is missing or stale. The numerical and encoding recipes
are unchanged; the second evaluation of roughly 100 million normal material
texels is removed. Standalone unflagged scene preparation still performs both
phases. Two forced registry-wide runs took 18m24s and 19m28s, compared with
44m39s for the previous serial run. Their 3,498 source/output/receipt files were
identical; all 2,531 accepted image encodings were preserved. Verified incremental
preparation took 44 seconds with eleven cache hits and no generated-file changes.
Earth's 25.4 GB pinned input verification accounted for 38 seconds. These local
measurements cover the preparation refactor before the later panel integration.

One registry-derived scheduler bounds concurrent preparation and waits for every
started child before reporting failure. Content receipts verify the input set,
toolchain and every output before reuse. Failed generation cannot produce a valid
receipt. Explicit full rebuilds bypass reuse; package recipes remain responsible
for source-specific conversion.

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
The integrated atmosphere inputs and prepared resources are bound to independent
material and native-state receipts. The forced preparation runs preserve their
outputs. Strict pixel comparisons retain differences; final visual acceptance
is not established.

## Production data closure

Uranus and Neptune control modules now import small generated lens-control records
instead of material-bearing `preparedLenses.mjs` modules. The existing scene
preparation chain generates these records offline. The actual `objectControls`
objects compare deeply equal before and after, preserving labels, descriptions,
titles and defaults, including shared shell title imports.

The imported generated modules shrink from 146,828 to 753 bytes for Uranus and
145,284 to 670 bytes for Neptune: 290,689 raw bytes removed from those imports.
The production client closures no longer reach either large lens module. This
is a source-payload measurement. A complete earlier all-object transfer capture
contains 44 measurements; final integrated performance remains unqualified.

## Final integration and validation status

The later shared zoom/sky-input and panel/legend commits are preserved through
normal merges. One common offline control compiler converts each editable
`site/control-content.source.mjs` recipe to literal runtime control data, including
legend colors and categories. It runs immediately before presentation preparation;
source recipes and generated outputs have separate preparation-cache roles.
Uranus and Neptune keep their small control inputs through this integration.

The recorded source passes strict ownership checks for all eleven objects. Real
Chrome observed the shared native owners in 22 cases, shared conformance passed
143 cases, and playback passed 22 cases. The original browser aggregate stopped
at an obsolete Saturn assertion; its corrected compound harness passed all six
cases at DPR 1/2. The unit diagnostics recorded 1,093 passes and two obsolete
preparation-command assertions, whose corrected focused checks passed.

At the user's request, no further full preparation, capture matrix or aggregate
was launched after the final integration. The current code therefore carries the
recorded evidence and its source limits, without a final aggregate-green claim.
Strict rendered differences and final production performance remain unqualified.
See [the proof and actual adapter differences](generic-runtime-contract-proof.md)
for the completed measurements and unresolved boundaries. PR2 remains unmerged.
