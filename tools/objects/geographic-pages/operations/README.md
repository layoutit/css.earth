# Geographic-page operations

These acquisition, authoring, release and local-mirror operations select their
object explicitly with `--object=<id>`. They read scientific/source declarations
from `src/planets/<id>/source` and prepared scene/page JSON from
`src/planets/<id>/prepared`; no body-owned executable modules are imported or
generated. The current WorldCover provider and pinned R2 service remain unchanged.
Provider qualification text and legacy release schemas describe the same accepted
datasets; moving the tools does not establish broader imagery coverage.

## Published, pinned hierarchy

`acquire-pinned-global-wmts.mts --object=earth` restores missing or corrupt packs
from the declared immutable delivery URLs. `--verify-only` makes no requests and
writes nothing. Every pack is size/hash verified; an invalid replacement cannot
overwrite an existing cache file. The operation drains in-flight work on failure.

`prepare-pinned-global-wmts.mts --object=earth` runs the shared pinned-hierarchy
preparer and writes `prepared/pages.json`. It verifies the complete release,
catalog footprint, internal references and prepared face geometry. It does not
regenerate the geometry, and it does not author the representative raster bank.
`--verify-only` does not replace prepared output.

## Explicit authoring

The separate `prepare:earth-global` package command retains full geometry
authoring, refinement, final hash verification and release integration. New
compiler identities are project-relative and include the prepared scene JSON;
accepted published releases retain their original immutable delivery identity.

`prepare-city-pages.mts --object=earth` retains the representative raster/source
window pipeline, including parent pages, gutters, nodata and published-coverage
assembly. Its optional publishing inventory is JSON at
`output/earth-city/<dataset>/assets.json`, beside `manifest.json`; it is not part
of the ordinary object runtime or pinned worldwide recipe. `--offline`,
`--verify-only` and verification-only `--region=<id>` keep their existing meaning.
The public preparation output remains prepared JSON, never a JavaScript module.

`acquire-city-catalog.mts`, `plan-city-coverage.mts`, `plan-wmts-coverage.mts` and
`measure-wmts-blocks.mts` retain their bounded WorldCover intake and planning
workflows. Add the explicit object argument to all of these commands.

## Publication and integration

Root `publish:earth-city`, `publish:earth-city-face`, `publish:earth-global`,
`status:earth-city-global` and `verify:earth-delivery` commands target these
operations with `--object=earth`. Existing upload flags, pinned bucket/account,
origin, content-addressed filenames, immutable cache and CORS requirements remain
in force. A source delivery prefix must match the selected object. Publication
is a separate explicit action; source or preparation validation does not imply
that any bytes were uploaded. Focused tests use mocks or dry-run validation only.

`integrate-city-coverage.mts` verifies receipt/source identities before updating
the coverage snapshot and prepared pages. `integrate-global-wmts.mts` requires a
complete, hash-verified manifest before updating release data and prepared pages.

`rebind-global-wmts.mts --object=earth <release-directory> <prior-scene.json>`
retains the strict all-face-bases comparison and two-input-change proof for
new project-relative authoring caches. It deliberately rejects historical
body-relative/executable-scene caches: their old compiler hashes cannot prove a
new source closure. Restore those already pinned releases using the acquisition
and pinned-preparation commands above; no proof is silently weakened.

## Local preview and tests

`wmtsLocalMirror({objectId, ...})` is shared by Astro and the normal preview tool.
It serves only the selected object's immutable pack route and bounded GET/HEAD
ranges, with the same local-byte and upstream-range validation.

Earth operational tests live in `tests/objects/unit/earth`. Browser paging
qualification remains separate. Passing mocked/local operational tests alone is
not proof of provider availability, publication, real-browser parity or worldwide
valid imagery coverage.
