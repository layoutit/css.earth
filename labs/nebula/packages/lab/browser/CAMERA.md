# Camera checks

Camera harnesses use the public Earth button (when configured), otherwise Reset, and pointer dragging. The camera preset menu no longer exists. `browser-camera.ts` reads normalized rendered rotation matrices, waits for transforms to settle, and fails if a drag leaves the scene unchanged.

Screenshot labels describe gestures (`horizontal-positive-wide`, `vertical-negative-short`), not measured angles. Their displacement is a fraction of the viewport, so they must not be interpreted as exact 30°, 60° or 90° scientific projections. `reference` means registered Earth orientation only when Earth is configured; otherwise it means the initial camera restored by Reset. M2-9 and SMC do not claim a measured Earth camera. Retention checks compare rendered orientation, distance, revision and retained leaves rather than a UI selection label.

Exact directional compositor checks remain in the source-owned renderer fixture `packages/renderer/src/volume/prepared-volume-runtime.test.ts`, which supplies explicit camera directions and tests axis transitions. Browser gesture screenshots complement those numerical checks; they do not replace them.

The helper test launches an isolated browser with an in-memory fixture, exercises real pointer events, and verifies that disabling the pointer handler makes the check fail. It does not connect to a live lab, start processing, or change saved source settings. Dataset harnesses retain their existing source prerequisites and request guards; run them only against the intended isolated lab state.
