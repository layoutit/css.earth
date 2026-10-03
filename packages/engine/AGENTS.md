# Engine package instructions

Own shared navigation, camera state, lifecycle, and renderer-independent execution contracts.
Accept renderer services through interfaces. Native events, CSS transforms, DOM nodes,
and browser resource handling belong to the concrete renderer outside this package.
Do not import the application, legacy runtime, or object-specific configuration.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside packages.
- Shared parsers validate versioned JSON into reusable object types and capability data.
- Objects using the same capabilities use the same implementation and differ through their JSON.
- Preparation and rendering use explicit interfaces; concrete renderer implementations live outside packages.
- Capabilities must compose so complex objects can add prepared layers or paging without planet-specific forks.
- The shared scene and navigation contract covers every prepared object and future object type, independently of navigation-menu membership.
- Scientific reference tables belong to astronomy/catalog; object presentation customizations do not.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility; keep bulk prepared data outside source code.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.

Numeric camera orientation math, heliocentric geometry and solar direction conversions live in `src/navigation/` and `src/solar-system/`, exported by the main entry. They depend on core numerics; no renderer, DOM or resource-loading implementation is imported. Flat solar matrices use the public `FlatMatrix3` name; navigation `Matrix3` remains nested.

Navigation owns presentation-to-world conversion (`src/navigation/world-camera-conversion.ts`), its structural
frame input and shared pose/viewport interfaces, default-view rotation from plain camera calibration,
silhouette-level walking and surface fly-to calibration. Objects parsers validate camera records before
calling engine. Rotation/reflection validation comes from core; engine never imports objects.

These functions take plain values: callers parse with `@cssearth/objects` first, then call engine. `engine` never imports `@cssearth/objects`; the `engine-imports-no-objects` architecture rule enforces it.
