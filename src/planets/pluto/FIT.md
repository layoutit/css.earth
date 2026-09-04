# Pluto contract fit

Target: `pluto`, Pluto, `dwarf-planet`, mean heliocentric distance 39 AU.
Scope: one standalone body, not the Pluto–Charon system.

## Source and renderer fit

The source oracle is the checked New Horizons color mosaic and USGS mosaic/DEM,
with provider metadata and exact hashes beside them. Fresh flat reference views
and Chrome globe views are produced by `tools/audit.mjs`. They are different
projections: this is source-bound visual evidence, not a native-camera pixel
match. Identified no-data areas receive a prepared gray grid, never invented
terrain. Conservative JPEG coverage detection can leave a dark boundary fringe.
`SOURCE.md` separates scientific facts from display choices and lists licenses.

Preparation produces 43 runtime images and seven checked manifest/scene/content
modules. Runtime retains 452 surface leaves, one curvature overlay, six sky
faces, one directional Sun, one camera, and the standard interaction lifecycle.
Three real observation lenses exercise the unchanged lens race/teardown gates.
The single canonical highest-density bank is selected regardless of display
scaling and never swapped later. Projective texture warps are baked offline;
the retained scene uses affine frames with flat child textures.

## Contract gaps demonstrated

| Gap | Smallest included change | Evidence |
| --- | --- | --- |
| Generic package validation required a NASA importer record and global editorial path. | Keep byte/source closure generic; validate each provider where its snapshots are owned. | Pluto uses owned NASA/JPL inputs; a complete non-NASA fixture passes, while corrupt and undeclared bytes fail. Existing NASA snapshots still get full provider validation. |
| Search omitted the Sun and the scale used a fixed identity list. | Search every `OBJECTS` entry; select planets through factual classification. | Unknown future-body fixtures; real navigation across all 11 objects on desktop/mobile. |
| Shell marker size/ring tables had no Pluto entry; preparation had a planned-object fallback. | Move existing presentation into each marker recipe and prepare one shared atlas/table. | Every package migrated; unknown package works without a shared id branch; missing recipes fail. Source recipes are preserved, but lossy atlas re-encoding changes legacy marker pixels; this is an intentional reviewed shell diff, not pixel preservation. |

No shared renderer, camera, input, scene lifecycle, router, or adapter code
changed. No production dependency, second registry, capability framework,
zero-lens mode, Sunless mode, or arbitrary-label framework was added.

## Required proof

The root acquire/test/build/browser gates include Pluto through `OBJECTS`.
No target-specific skip flags are used. The browser suite keeps exactly the
same camera, fly-to, motion, speed, visibility, lens-race, density, and retained
identity assertions for Pluto as for all existing objects.

The aggregate suite exposed an existing Venus test-input defect, reproduced on
the untouched base commit: an inward wheel cannot rebase a target already
clamped at maximum zoom. The scenario now wheels outward and still asserts
exactly one rebase; runtime behavior and assertions are unchanged.

Final commands and fresh evidence are recorded in
`docs/objects-contract-implementation.md` at the repository root.
