# Architecture rules

`index.mts check` runs resolved graph rules (`rules.mts`) and repository rules
(`repository-rules.mts`). Repository rules always fail on findings, including
baseline updates. `file-cycles.mts` fails on any file-level import cycle in `packages/`,
counting type-only, dynamic and test imports; it has no baseline either.
Contract lint runs the check and `node --test .github/scripts/architecture/*.test.mts .github/scripts/architecture/*/*.test.mts`.

- `bake-without-renderer.mts` locks bake's dependency fields and forbids bake entries
  in the preparation renderer exception list. `declared-dependencies.mts` rejects
  undeclared workspace imports; its E1 fixture proves a bake import fails without
  declaring renderer. The declaration scanner also checks literal `require.resolve` calls. `preparation-without-renderer.mts` retains telescope's exact
  publication/transport exceptions and the declared renderer build-config metadata reader, and rejects stale entries.
- `format-schema-ownership.mts` scans TypeScript, Python and Astro source for
  versioned schema literals, including type literals and embedded template scripts.
  `schemaOwner` groups packages, lab packages, site and top-level tooling directories.
  A raw id in two owners fails; any raw duplicate of an objects source definition
  also fails. One owner's internal ids need no inventory. Tests, fixtures, data,
  prepared outputs and compiled output are excluded. Python/Astro use exact quoted-id
  matching; TypeScript uses its syntax tree.
  `format-schema-exceptions.json` contains only `{ schema, owners, reason }` debt.
  Owner sets must match exactly; stale entries, duplicates and empty reasons fail.
- `site-build-format-readers.mts` requires build readers to admit shared JSON through
  objects parsers before projection. Its AST scan discovers source addresses from
  tracked schema-bearing records; objects reader ledgers name generated addresses
  and format-specific readers. It follows local aliases, transports, callbacks and
  literal filename loops. Computed and cross-module paths remain analysis limits.

The declared import scanner and resolved graph do not prove arbitrary computed
runtime paths. There is no custom import-form parser. Binary magic/version values
without schema ids are outside the literal rule: generic numeric/string matching
cannot distinguish format constants from unrelated values reliably.

See [prepared format ownership](../../../docs/prepared-format-ownership.md) for the contract and limits.

The source-manifest exception is retained only for the pre-build body-reference check
and preserved Python distant-worlds authoring.
[Schema-identifier conformance tests](../../../packages/bake/src/sources/python-schema-identifiers.test.ts)
pin the manifest, archived-camera and object-text Python literals to their browser-safe objects constants.
The archived-camera and object-text exceptions retain only bake as an owner: preserved Python writers cannot
import TypeScript. Changing any retained spelling must fail its conformance test.

Other preserved Python grid, registration and native star-processing protocols retain specific ledger reasons.
[Grid conformance](../../../packages/bake/src/shell/shell-grid-schema.test.ts) and
[lab protocol conformance](../../../labs/nebula/packages/lab/src/server/services/schema-protocols.test.ts)
pin their source checks and retained fixtures. Bake recipe routing identifiers stay bake-owned;
the molecular catalogue wrapper stays lab-owned, separate from reconstruction table data.

Workspace build order is derived from `pnpm-workspace.yaml` and package manifests by
`packages/bake/src/preparation/workspace-graph.ts`, a Node-only bootstrap reader.
`node .github/scripts/architecture/workspace-builds.mts` prints dependency-first build names;
`--run` builds them. Optional package names select their dependency closure.

## Boundary and retained limitations

This subsystem owns repository policy, CI findings and the repository-specific
baseline. Its resolver, zones and exceptions describe this checkout; it is not a
published architecture library. Keeping those authored inputs beside the check
is intentional (A1); extraction would add an API without an external consumer.

Integration independence currently uses declared workspace dependencies only.
Non-workspace site, source and script owners have no manifest dependency edges;
this is not proof of source-graph independence (A102). Extending it requires a
resolved owner graph, including build/runtime distinctions, rather than guessing
edges from owner names.

Preparation additionally recognizes literal sibling renderer URLs, package
imports targets, tsconfig extends and compiler-option paths. It still does not
prove computed loaders, configuration inheritance or a dependency routed through
an exempt consumer's re-export (A202/A251). The telescope implementation bundler reads the renderer build configuration through the declared
`RENDERER_BUILD_CONFIG_PATH`, which the rule checks as a named metadata exception (A203).

Every PR contract-lint lane also runs `checks/check-stale-references.mts` and its tests.
The short `checks/retired-paths.mts` ledger identifies drained paths from rename history
and the relocated owners whose checkout roots must stay module-relative. The check
reads live commands, manifests, documentation, CI paths, generator literals and import
specifiers. Historical records retain the old path with an adjacent `(now ...)`
replacement; test fixture text is excluded through syntax, while actual test imports
and process calls are checked. Extend the ledger when another owner is retired.

`ratchets/authoring-policy.mts` rejects direct (including imported aliases and namespace calls)
`combineBodyMaps` calls in telescope sources and both authoring roots. The exact HST
slit-scan author is retained for trial-placement diagnostics; it publishes through
`combineUnderPolicy`. The syntax check follows local aliases, namespace destructuring, element access and call/apply.
The same rule compares CLI implementation exports with the committed
`ratchets/cli-exports-baseline.json` allowance (derived from main, may only shrink): entries may export `main`
or default implementations, but other exported functions, classes and value re-exports
belong in `src/`. Existing entries cannot gain exports beyond their recorded allowance. The check needs
no git refs or history and checks library surfaces rather than command-body complexity.

The format/root source ratchets are in `ratchets/source-ratchets.json`. Each remaining objects numeric
admission or ordering file and each working-directory command has a specific reason. New
files fail and stale allowances must be removed. Committed ceilings limit entry counts
without git history; tests pin each ceiling to its current count. Removing debt lowers
the ceiling, while any increase requires an explicit reviewed ceiling change. Missing
budget files fail in every checkout. Unit mutations prove math, sorting, root calls,
and budget growth fail; tests and comments are excluded through the TypeScript syntax tree.

## Pending site layout

The owner-decided plan is in docs/site-architecture.md. Moves, sibling tiers, explicit denies,
atomic edit groups, the decided loader design and a compact path/class inventory live beside it.
`site-architecture.mts` shares the ordinary check's live graph. `status: "planned"` findings always warn with a fix command and Actions annotation; there is no deadline or warning ceiling.
`status: "enforced"` makes every plan finding fail; the owner flips it when S4 ends. Strict `--accept` always fails on plan findings. Existing rules and scanner failures still fail.
The architecture baseline is unchanged.

Tests are leaf consumers (`tests: "any-tier"`) but remain in file SCCs. Production
cannot import tests, fixtures or helpers. New helpers use `.test-support.mts`.
Only env.d.ts remains at the source root; generated declarations sit beside their
ignored modules in prepared. Lazy and type imports count. Lateral edges are forbidden.

The edits envelope contains `edits` with stable ids and `changes` that partition
those ids in S3 order. New modules declare imports. Minimality removes each atomic
change group; a removal must fail. Sequence replays S3 at current paths and S4 with
unmoved files in synthetic legacy. The doc explains the loader proof limitation.

Acceptance reads declarations from tracked files only, so ignored generated files never change the result. From a clean
checkout with installed dependencies:

```sh
export PATH=$HOME/.nvm/versions/node/v22.23.2/bin:$PATH
pnpm install --frozen-lockfile
node .github/scripts/architecture/site-plan/import-declarations.mts --prefix site/ --out output/plan7/imports.json --check-against-scanner
node .github/scripts/architecture/site-architecture.mts --write
node .github/scripts/architecture/site-architecture.mts --accept
node .github/scripts/architecture/site-architecture.mts --identity
node .github/scripts/architecture/site-architecture.mts --sequence
node .github/scripts/architecture/site-architecture.mts --minimality
pnpm check:architecture
```

Each move PR deletes applied map entries and updates asset/test identities,
remaining edits, tables, references and wiring. It runs
`node .github/scripts/architecture/site-architecture.mts --references --old <old-paths>`
after moves; zero live occurrences are required. Historical and plan pointers are
reported separately. S3 PRs remove applied groups. L6 removes null deletion entries.
`--references` prints full line-numbered evidence on demand; do not commit that output. `--write` regenerates all marked tables
and references. Ordinary additions while planned do not turn plan warnings into
application refactors. Strict acceptance, sequence and minimality remain blocking
proof commands. See the plan for the contributor workflow and S3 behavior gates.

When a warning names your file, update its mapping or semantic edits, run `--write`,
then `--accept`. Keep application behavior unchanged; a planned warning never blocks
`pnpm check:architecture`.
