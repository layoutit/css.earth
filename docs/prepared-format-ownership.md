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
