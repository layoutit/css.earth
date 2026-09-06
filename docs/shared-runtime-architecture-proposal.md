# Shared prepared presentation architecture

All eleven entries in [`OBJECTS`](../site/objects.mjs) now use
`cssearth-object-runtime@2`. Each package supplies prepared presentation data and
control content to the same runtime. There are no package presentation callbacks,
private material publishers, or shared branches selected by an object ID.
The recorded strict source audits and all-object native ownership checks pass.
Final integrated visual and performance qualification remains unproven. See [the proof](generic-runtime-contract-proof.md).

## Ownership and the preparation boundary

| Concern | Shared executable owner | Package data |
| --- | --- | --- |
| Registry, navigation, application shell | `OBJECTS`, object adapter, router, shared shell | Identity, route, classification, source attribution, control content |
| Mount, readiness, disposal, fatal cleanup | `object-runtime.mjs`, `scene-lifetime.mjs` | Validated v2 definition |
| Retained scene construction | `prepared-presentation.mjs` | Ordered nodes, final CSS and attributes |
| Lens and setting transactions | `object-control-binding.mjs`, `object-selection-runtime.mjs` | Defaults and exhaustive selection variants |
| Material demand and publication | `prepared-material-demand.mjs`, `prepared-material.mjs` | Address banks, frame mappings, bounded demand and rotation policies |
| Camera, orbit, sky, directional Sun | Shared cubic-sky, prepared-camera and Sun modules | Prepared projection and celestial records |
| Decode, leases, cancellation, residency | `prepared-image-store.mjs`, `prepared-residency.mjs` | Resource catalog, pool capacities and retention policies |
| Native animation and speed | `prepared-playback.mjs` | Prepared animation targets, roles, keyframes and rates |
| Optional page layers and destinations | Shared prepared-map and navigation modules | Prepared page trees, carrier indices, catalog and navigation bounds |
| Diagnostics | Shared runtime and browser-profile implementation | Read-only observation mappings and audit facts |

Source conversion, geometry, atlas creation, atmosphere integration, material
addresses and control legends are prepared offline. One shared control compiler
turns each editable `site/control-content.source.mjs` recipe into literal
`site/control-content.mjs` data before presentation preparation. The browser validates and decodes data, mounts the
prepared records, selects addresses and applies view-dependent affine transforms.
It does not import a package builder or derive scene assets. Source and provenance
stay beside each object. The highest prepared asset density is selected once per
mount, independently of DPR.

There is one object adapter and one mounted object scene. Prepared roots may also
include retained overlay elements; they do not create additional object scenes.
No canvas, WebGL, SVG scene renderer, runtime gradients, masks, filters, blend
modes or clip paths are needed by this contract.

## The executable contract

Each client binds `createObjectRuntime(runtimeDefinition)`. Its definition contains
only static imports and this data binding:

```js
export const runtimeDefinition = Object.freeze({
  ...PREPARED_PRESENTATION,
  schema: PREPARED_OBJECT_RUNTIME_SCHEMA,
  id: "saturn",
  controls: objectControls,
});
```

[`prepared-presentation-contract.mjs`](../src/platform/prepared-presentation-contract.mjs)
validates `cssearth-prepared-presentation@1` and the v2 runtime schema. It rejects
unknown fields, functions, invalid references and incomplete or overlapping
selection variants. The plan contains:

- `tree`: retained nodes and one camera/scene pair. `tree.properties` is a shared
  dictionary of final style assignments; each node references an ordered list of
  dictionary entries. The builder preserves `cssText` followed by those assignments.
- `variants`: final style, attribute, class and texture writes for each lens and
  toggle combination, required resources, selected material records and optional
  navigation bounds. Lens selection is exclusive; speed belongs to shared playback.
- `materials`: final address banks, scalar frame mappings, resource demand and
  angle, planar or ellipsoid rotation parameters. `frameOffset` selects a prepared
  address range without introducing another publisher. `publishWithAddress`
  prevents rotation from advancing without an available material address;
  `onlyWhenEnabled` controls hidden-track rotation.
- `viewBindings` and `animations`: bounded camera bindings and prepared native
  pose animation. Optional `motionFrame`, `pageLayers` and `destinations`
  bind the same shared navigation and page machinery.

The common selection owner keeps desired state separate from committed state.
It protects the current resources while replacements decode, rechecks demand
against the current view, and publishes the complete selection before promoting
it. Failed or cancelled demand cannot partly replace the committed lens. The
common fatal boundary retires a scene if native publication fails.

## Remaining adapter differences are data

This inventory comes from the current generated plans and actual control exports.
Frame counts describe prepared addresses, not separate rendering implementations.
All pool and fallback behavior below is executed by the same shared owners.
Each package also supplies its own camera dimensions, limits and initial pose,
sky/Sun coordinates, retained node geometry, texture URLs, control labels and
observation mappings. The table identifies the differing track and optional-content
structures within that common schema.

| Object | Lens IDs | Material and retained-content differences |
| --- | --- | --- |
| Sun | `photosphere`, `magnetic`, `chromosphere`, `corona` | Self-lit textures, corona and limb; no dynamic material track or directional-Sun plan. Four selection variants. |
| Mercury | `normal`, `enhanced`, `topography`, `interior` | One 256-frame lighting track, eight frames per row, three reusable row slots and symmetric prewarming. Angle rotation, prepared interior pose animation, eight selection variants. |
| Venus | `clouds`, `radar`, `elevation` | One 32-address composite atlas with a prepared phase remap and fixed shadowless address. Angle rotation; atmosphere and stars settings; 24 variants. |
| Earth | `normal`, `buenos-aires-noise`, `topography`, `night-lights`, `cross-section` | Separate 128-frame lighting and atmosphere tracks; each has three row slots, four frames per row and symmetric prewarming. Planar rotation, seven-page surface banks with fourteen transition slots, two prepared map layers and a destination catalog; 20 variants. |
| Moon | `surface`, `topography`, `crust` | Prepared surface/pole textures, no dynamic material track; twenty mount-retained resources and three variants. |
| Mars | `normal`, `elevation`, `thermal` | One 512-address composite track: two 256-frame ranges selected by Shadows. Three reusable row slots, same-column fallback, angle rotation gated by address publication; six variants. |
| Jupiter | `normal`, `ultraviolet`, `methane` | One 181-frame lighting track, four frames per row, three reusable slots, directional prewarming and nearest-frame fallback. Planar rotation, prepared rings and moons; twelve variants. |
| Saturn | `normal`, `ultraviolet`, `methane`, `thermal`, `cross-section` | Two 256-address tracks: sixteen exterior banks and four normal-color interior banks, with two atlas transition slots per track. Shared ellipsoid projection, current exterior demand and visible interior demand; twenty variants. |
| Uranus | `normal`, `methane`, `near-infrared` | One 256-frame track with three banks and sixteen frames per row. Required row offsets `[-1, 0, 1]`; six slots protect current and replacement neighborhoods. Planar rotation, prepared rings; twelve variants. |
| Neptune | `normal`, `methane`, `near-infrared` | One 256-frame track with three banks and sixteen frames per row. Three lighting slots; demand follows departure from the default view, enabled state or lens change. Planar rotation, eight static-variant transition slots and prepared rings; twelve variants. |
| Pluto | `surface`, `topography`, `monochrome` | Prepared surface/pole textures, no dynamic material track; twenty mount-retained resources and three variants. |

Saturn's cross-section uses the same exclusive lens state as Mercury's interior
and Earth's cross-section. Selecting it again leaves it selected; selecting any
exterior lens exits it. There is no independent interior toggle or remembered
exterior lens. Rings and Shadows remain settings. Its 128 source interior frames
are expanded to the common 256-address lookup during preparation.

Earth and Mars use the same [offline atmosphere integrator](../tools/prepared-atmosphere.mjs).
Earth supplies Rayleigh/Mie layers with its recorded scattering and exposure
response; Mars supplies a calibrated isotropic exponential shell and photographic
limb-color response. Earth publishes a separate atmosphere track. Mars publishes
prepared atmosphere/surface composites in both shadow states, so disabling ground
shadows does not disable directional atmosphere. Both use the same material
publisher. Fresh asset regeneration and final visual receipts remain pending.

The source audit is a regression barrier over the real import closure, including
orphan executors and shared object-ID dispatch. It is not a formal proof against
arbitrarily obfuscated JavaScript or evidence of native browser ownership by
itself. [Implementation details](shared-runtime-implementation.md) and the
[proof status](generic-runtime-contract-proof.md) separate those claims.
