# Tuttle: latest main integration

Merge `3a43fd09049b8f0ef822d87b06754aea3e080892` combines Tuttle's two datasets with main `430f4e3e0de81711c8f7d2995aaab456c727ea31`, including its Earth imagery, scientific moon surfaces and 41 new asteroids. The registry now contains 300 objects and six comets.

The [600-file comparison](evidence/tuttle-main-integration-audit.json) checks every object's descriptor and prepared runtime against main, using Tuttle's previous accepted head for its package. Existing body geometry, materials and presentation are preserved. Changes are shared marker indices/counts, corresponding payload hashes, the Sun's combined source pin and Tuttle's 41 additional context names from the astronomy catalog. The [world and shape comparison](evidence/tuttle-main-integration-world-shapes.json) confirms that the combined world source and prepared context add only Tuttle; all 298 existing entries are unchanged.

Both shared marker atlases were rendered from the combined recipes. The 282 unchanged context images were verified against their accepted Git bytes and reused. Marker bindings and JSON transports were regenerated from the accepted prepared definitions, and the combined world context and minimap were rebuilt. Tuttle was also regenerated through the merged source preparation code: both terrain meshes, surface definitions and the full 34-image inventory remain byte-for-byte unchanged.

[Hubble/Spitzer, DPR 1](evidence/tuttle-main-integration-dpr-1-model-shadows.png) · [Arecibo, DPR 2](evidence/tuttle-main-integration-dpr-2-arecibo-shadows.png) show the rebuilt production scene.

## Validation

The [qualification receipt](evidence/tuttle-main-integration-checks.json) records the application revision and log hashes. Builds and typechecks pass, along with 353 preparation tests, 249 renderer tests, 365 shell/registry/transport tests, seven Tuttle model tests, three package/asset checks and 28 shared preparation checks. All 21 Tuttle source entries verify. The production build contains 301 pages; all 300 object assemblies and pinned JSON transports pass.

The [production browser receipt](evidence/tuttle-main-integration-browser.json) covers both datasets and lighting banks at DPR 1/2, plus a run using freshly downloaded Tuttle assets. It verifies retained geometry, active-dataset surface targeting, flight, drag, zoom and the narrow layout. The [DOM audit](evidence/tuttle-main-integration-dom.json) covers both DPRs. Five [lens lifecycle cases](evidence/tuttle-main-integration-lenses.json) and [26 navigation visits](evidence/tuttle-main-integration-navigation.json) through the six comets pass.

The earlier Patroclus CI assertion is corrected in the incoming main; the current preparation suite passes it. Earlier detailed source-fit and timing measurements in [the comparison review](TUTTLE-ARECIBO.md) remain bound to their recorded revision. These desktop browser checks do not establish physical-phone results.

## Delivery scope

The initial download of incoming main assets returned HTTP 404 for `earth-enso-legend.png`. Changed main assets needed locally were recovered from existing worktrees only after exact inventory size and SHA-256 matches. That local recovery does not establish fresh remote delivery for all main assets. Tuttle's independently checked fresh download covers all 34 published assets; its assets did not change in this merge.
