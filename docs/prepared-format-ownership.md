# Prepared format ownership

Shared prepared types, schema ids, validators and binary codecs belong in the
browser-safe `@cssearth/objects` entry. Writers and readers import the same constants;
preparation, projection, mounting and file I/O stay with their owners.

Contract lint enforces two hard rules with mutation tests:

- Bake declares no renderer dependency in any dependency field and has no named
  renderer exception. The existing declared-dependencies rule rejects ordinary
  undeclared workspace imports and literal `require.resolve` calls. Telescope retains only its named C1c consumers.
- Non-test TypeScript, Python and Astro source is grouped by package, lab package,
  site or top-level tooling owner. A versioned schema id spelled raw in two owners,
  or raw outside objects when objects source defines it, fails. Ids confined to
  one owner outside objects are internal and need no entry. Tests, fixtures, data,
  prepared outputs and compiled output are excluded.

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
