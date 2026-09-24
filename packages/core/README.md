# @cssearth/core

Runtime validation shared by the browser runtime, the site and the preparation tools. It checks values
that arrive from outside the type system (JSON files, prepared payloads, archive records) and returns
them typed, or throws a `TypeError` that names the value. Zero dependencies and no host globals.

| entry | what it holds | failure |
|---|---|---|
| `@cssearth/core` | `isRecord`, `isPlainRecord`, `isFiniteNumber`, `hasErrorCode` | predicates, no throw |
| | `requireRecord`, `requireArray`, `requireString`, `requireFiniteNumber`, `requirePositive`, `requireBoolean`, `requireNonemptyText` | `<label> must be …` (label defaults to `Source value`) |
| | `checks(failure(prefix))`: `record`, `array`, `text`, `finite`, `positive`, `integer`, `boolean`, `choice`, `unique`, `numbers` | `<prefix><label> must be ….` |
| | decoders: `shape`, `optional`, `nullable`, `array`, `dictionary`, `boolean`, `choice`, `text`, `number` | `<context> <key>: <reason>` |
| `@cssearth/core/schema` | structural guards: `object`, `array`, `tuple`, `union`, `literal`, `json`, … and `parse` | `Invalid <label> structure at <path> (<value>).` |

Getters take at most two parameters, so `requireArray(rows).map(requireString)` works and names a
failing element by its index. `shape` keeps fields it does not decode; its default context is
`Terrestrial source`, the wording the source records have always reported.

```text
packages/core/
├── src/           validate.ts, decode.ts, schema.ts and their tests
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

ESM, CommonJS and declarations are built with tsup, like the other packages. From the repository root:

```sh
pnpm --filter @cssearth/core build
pnpm --filter @cssearth/core typecheck
pnpm --filter @cssearth/core test
```
