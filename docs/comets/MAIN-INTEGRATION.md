# Comet branch integration with main

PR #37 combines comet head `e15beb931f4b7d57d7a4bbcadc4adf2877ab12b9`
with main `9ff311c4ce719abd87ee12c81b4c378be8d93492`. The first merge resolved
142 conflicted paths against `679254264fc8e5c5eef7905974482ac60788735e`.
Main then added six radar asteroids; a second merge resolved nine more conflicts.
The subsequent UI update from PR #44 merged without conflicts.
PR #42 then added four outer moons; the final merge resolved 20 more paths.
The single registry retains main's 165 objects plus all five comets. The PR remains unmerged.

The authored resolution retains both sets of astronomy fixtures and body records,
the PDS comet loaders and constraint handling, and main's STL loader and closest
source-surface sampling. Shared solar geometry, navigation atlases, marker bindings,
world context and prepared object transport are regenerated for the combined registry.
The universe source retains every incoming main entry exactly and adds the five
existing comet entries.

All five comet compilers completed. Their terrain, source-lighting receipts and
runtime asset inventories are byte-identical to the original PR head. Halley, 67P,
Hartley 2 and Tempel 1 retain 1,000 triangles; Wild 2 retains 992. Prepared scene
changes are confined to heliocentric context. No new comet, image lens, coverage
claim, spin or material is introduced by this integration. The Giotto image lens
remains [unqualified](HALLEY-GIOTTO.md).

## Validation

- Source verification: all 170 objects (final main update).
- Package tests: 610 pass.
- Focused shape, lighting, radial surface and scientific raster tests: 35 pass.
- Comet object tests: 10 pass, including closed topology and constraint grids.
- Renderer tests: 337 pass.
- Platform suite: 1,373 of 1,374 initially passed. The single failure was an
  incoming orbit-registry test that omitted the comet classification from its
  expected list. The corrected test file passes all 11 tests. No application
  data or source expectation was loosened.
- Production build and assembly pass at application revision
  `96bc46867594b83c1e534840e7f0db362ae12c31`.
- Five-comet navigation passes at DPR 1 and 2: 22 hops, retained shell and universe,
  one mounted scene, no node or stylesheet accumulation, no browser errors.
- Ten default/rotated comet captures were inspected. Native triangle counts and
  loaded asset hashes match the pinned inventories.
- All 234 shell tests pass.
- The complete 166-object Chrome run passes all 332 object/DPR cases and both
  six-hop navigation sequences. This evidence predates the final four-moon update.
- The final 170-object source verification, package tests, production build and
  focused orbit/moon regressions pass. The last four-moon and comet navigation
  smoke checks are recorded in the local integration logs.

## Reproduction details

Use Node 24.19.0 and pnpm 10.33.0. The initial source acquisition stopped because
some incoming objects require ignored generated context images. The initial 99 missing local inputs and 31 inputs from the radar update were restored from existing worktrees only after matching
both manifest byte counts and SHA-256 pins. Source verification then passed.
Four acquired `shape/pck00011.tpc` files remain local untracked inputs; they are not
part of the merge payload.

The concurrent preparation wrapper rejected cache receipts when another comet
updated its descriptor hash during generation. The object compilers themselves
succeeded; Wild 2, which the wrapper had not started, was compiled separately.
Shared navigation and object serialization then run sequentially. Fourteen
legacy title sources were restored to their exact incoming records after the
shared generator added only a schema field and invalidated their source pins.
These preparation-workflow limits are not reported as passing cache reproduction.

The full 160-object navigation bake completed. For the six-object main update,
the shared atlases were rendered again while existing context images were
retained only after matching their recipe and image hashes. The six new objects
went through the standard Chromium presentation preparer. Unchanged bodies reused
their already prepared presentation bindings while marker references, world frames,
context and serialized payload hashes were updated. The redundant all-body
Chromium prebuild was stopped; the production build is run directly after this
serialization. The normal full prebuild is not claimed as completed. The final four-moon
update retains 151 context images with matching recipe and image hashes, and
uses the same prepared-binding serialization after regenerating solar geometry.

The separate full preparation suite and new drag performance traces are not part
of this conflict-resolution pass. Earlier performance measurements retain their
original code/build provenance and are not measurements of the merged runtime.
Local logs and byte-identity evidence are under
`output/comet-intake/main-integration/`.
