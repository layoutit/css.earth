# Prepared format ownership

Shared prepared types, schema ids, validators and binary codecs belong in the
browser-safe `@cssearth/objects` entry. Writers and readers import the same constants;
preparation, projection, mounting and file I/O stay with their owners.

Contract lint enforces three hard rules with mutation tests:

- Bake declares no renderer dependency in any dependency field and has no named
  renderer exception. The existing declared-dependencies rule rejects ordinary
  undeclared workspace imports and literal `require.resolve` calls. Telescope retains only its named C1c consumers.
- Non-test TypeScript, Python and Astro source is grouped by package, lab package,
  site or top-level tooling owner. A versioned schema id spelled raw in two owners,
  or raw outside objects when objects source defines it, fails. Ids confined to
  one owner outside objects are internal and need no entry. Tests, fixtures, data,
  prepared outputs and compiled output are excluded.

- Build-time site JSON readers admit known shared formats through their objects reader.
  The AST rule derives schemas and source paths from objects definitions and tracked JSON;
  objects' format-reader ledgers supply generated paths and format-specific admission names.
  It follows local path bindings, JSON transports and parse callbacks, and rejects projection
  before admission. Computed paths and cross-module transport remain static-analysis limits.

The [rule guide](../.github/scripts/architecture/README.md) links the implementation.
The [exception list](../.github/scripts/architecture/format-schema-exceptions.json)
contains only shared-schema debt, with the schema, exact owner set and a specific
reason. Stale exceptions, changed owner sets, duplicates and empty reasons fail.
It is not an inventory of owner-internal formats or individual paths.

Computed runtime resolution, renderer access through a telescope exception's
re-export, and telescope's computed tsup configuration loading are known limits.
Numeric binary versions and magic strings without schema ids are not scanned.
No serialized value changes when an existing objects constant replaces a literal.

Schema constants are exported beside their objects-owned contracts. The source-manifest
identifier is browser-safe and available from the main entry; its filesystem validator
remains in `@cssearth/objects/node`. The pre-build body-reference check and preserved
Python distant-worlds authoring retain their raw manifest identifier. The objects
schema-identifier tests pin both spellings; mutation checks must reject either drifting.
Preserved Python camera and text writers likewise retain narrow, conformance-tested exceptions.
Their TypeScript consumers import the objects-owned contracts.

Archived-camera data (including `SpiceCamera`), cited object/prepared-text records and prepared destinations
are browser-safe contracts in `packages/objects/src/prepared-data/`, exported from `@cssearth/objects`.
Their node:test suites run in the packages lane. Camera fitting and kernel computation stay with bake/SPICE;
text budgets and editorial checks stay in site; destination preparation and search projection stay with bake/site.

Bake recipe lane identifiers remain bake-owned when site only delegates preparation; site imports the identifiers.
The lab molecular catalogue envelope is lab-owned, separate from reconstruction table data. Preserved Python
registration and native processing protocols keep specific ledger reasons, with source/fixture conformance in
`schema-protocols.test.ts` and `shell-grid-schema.test.ts`; scientific processing is not relocated.

VO snapshot validation in objects rebuilds the ADQL `obs_id IN (...)` clause from the
selected IDs, including quote escaping, to check that the retained query matches its
spatial selection. Query planning and execution remain in telescope.

The moved-format ownership test scans git-tracked TypeScript and JavaScript with the
TypeScript AST, relative to the test's repository location. Schema references outside
objects are limited to imports/re-exports, named publishers, and exact retained
routing or scientific checks. Distinctive parser diagnostics also reject renamed
copies. Generic record/text checks are not format-specific diagnostics.

## Known limits in second readers

- **KNOWN LIMIT:** `packages/telescope-cli/authoring/circumstellar/author.mts` reads
  reconstruction identity, retired fields and grid compatibility before its scientific bake.
  The complete objects reader additionally requires scientific fields that this historical
  admission does not validate; replacing it directly would reject previously accepted inputs.
  A shared, explicitly named authoring subset is needed before that reader can replace it.
- **KNOWN LIMIT:** `packages/bake/src/delivery/runtime-assets.ts` scans volume-presentation
  identity while assembling metadata restoration. Its historical scanner accepts incomplete
  records and skips unrelated schemas; the complete source parser requires restored dataset
  provenance. A shared identity-only admission is needed to preserve that scanner contract.
- The lab delivery adapter delegates the authored envelope to bake's objects reader; its
  remaining generic object checks inspect symmetry output descriptors, not a second delivery parser.
- Compiler publications use objects' explicitly named ownership readers for depth and
  photometric MGE inputs. Publication admission accepts identity/evidence-only snapshots;
  full scientific recipe parsers retain their stricter contracts. The physical-evidence ledger
  remains a **KNOWN LIMIT**: receipt admission checks subject identity and three arrays,
  whereas sampled-prior qualification additionally checks source attribution and addressed evidence;
  applying that policy to every depth receipt would change its historical admission.
