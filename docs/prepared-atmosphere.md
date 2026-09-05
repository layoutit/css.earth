# Prepared directional atmosphere

Mars and Earth use one preparation kernel and one material-selection/publication
helper. Their four-line clients still bind `createObjectRuntime`; no private
image owner, scheduling loop, controls, or renderer was introduced.

## Preparation and ownership

`tools/prepared-atmosphere.mjs` integrates sunlight through an exponential shell,
including solid-body solar occlusion and the gas outside the surface silhouette.
Inputs are the output dimensions, projected disc, unit point-to-Sun direction,
body radius, atmospheric height, density layers, and display-transfer parameters.
It returns RGBA pixels for preparation. A null atmosphere returns transparent
pixels, never a fallback glow. Nothing in this module is imported by the browser.

Object packages continue to own source parsing, provenance, projected geometry,
calibration, asset layout and the retained material attachment:

- Mars supplies its checked scale height and photographic limb calibration.
  It composes the shared atmospheric result with ground lighting offline into
  two modes. Shadow-off preserves the accepted full-phase surface curvature.
- Earth supplies its checked Rayleigh/Mie coefficients, density scale heights,
  body illumination and exposure/opacity transfer. Its existing two material
  elements and resource pools remain in use. Atmosphere now covers the full
  Sun-phase range instead of the earlier pitch-limited mapping. Surface imagery,
  surface geometry, city paging, camera and sky are unchanged.
- Mercury and other packages not migrated here retain their existing rendering
  and source assets. The platform does not add an atmosphere to them.

Both profiles use the same shell integration. They do not pretend to share the
same physical or photographic response. Incoming sunlight travels opposite the
point-to-Sun vector, so the Mie forward-scattering direction is backlit gas.

## Runtime

`src/platform/prepared-illumination.mjs` maps the camera-relative Sun direction to
a prepared phase and image rotation. The prepared coordinate convention is
right, down, toward the viewer. A shadowless-bank offset changes the selected
material, not the atmospheric phase or rotation.

Existing `object-selection-runtime.mjs` and `prepared-residency.mjs` retain sole
ownership of desired/committed state, decoding, cancellation and resource limits.
The shared publisher changes the image address and rotation together only when
the requested image is available. Packages provide their existing material
attachment and prepared layout. There are no object-ID branches in the shared
atmosphere implementation and no changes to `OBJECTS` or the adapter.

Mars still has one material element and at most three material images; Earth
still has its existing lighting/atmosphere elements and three slots per material
pool. The cost is prepared data, not runtime scattering: Mars's two-density bank
is 57,939,136 bytes versus 18,964,870 previously. It is streamed in bounded rows,
not loaded in full. Canonical mount-time density selection is unchanged.
Earth's atmosphere rows start decoding immediately: the old 120 ms stability
delay exceeds a four-frame row's dwell time during a brisk orbit and could keep
postponing new rows. Ground lighting retains its existing policy. There is no
new scheduler, and both material pools retain their three-image limits.

## Scope and verification

This is a globe-view shell approximation, not multiple scattering, an HDR
exposure simulation, terrain haze, or a near-ground horizon model. A future
object can supply another profile and prepared layout without new runtime
ownership; a model outside this approximation needs appropriate offline
preparation, not a fabricated parameter fit.

Tests cover profile-dependent output, airless transparency, directional symmetry,
full phase endpoints, backlit solid-body occlusion, integration convergence,
shadowless curvature, and both actual packages using shared selection under
shadow toggles. Existing Mars/Earth browser smoke tests also exercise several
latitudes, longitudes and zooms with shadows on/off, checking stable DOM and
bounded image slots through actual Chrome decoding. The same checks run at
DPR 1 and DPR 2 through the existing browser suite. This establishes the shared
implementation and its behavior; it does not claim native pixel parity.
