# @cssearth/core

Runtime validation and small shared helpers for the browser runtime, the site and the preparation tools. Validation
checks values that arrive from outside the type system (JSON files, prepared payloads, archive records) and returns them
typed, or throws a `TypeError` that names the value. Zero dependencies. The main and `schema` entries use no host
globals and no Node built-ins, so browser bundles can import them; hashing and the repository root need Node and live
behind the separate `@cssearth/core/node` entry.

| entry | what it holds | failure |
|---|---|---|
| `@cssearth/core` | `isRecord`, `isPlainRecord`, `isFiniteNumber`, `hasErrorCode` | predicates, no throw |
| | `requireRecord`, `requireArray`, `requireString`, `requireFiniteNumber`, `requirePositive`, `requireBoolean`, `requireNonemptyText` | `<label> must be …` (label defaults to `Source value`) |
| | `checks(failure(prefix))`: `record`, `array`, `text`, `finite`, `positive`, `integer`, `boolean`, `choice`, `unique`, `numbers` | `<prefix><label> must be ….` |
| | decoders: `shape`, `optional`, `nullable`, `array`, `dictionary`, `boolean`, `choice`, `text`, `number` | `<context> <key>: <reason>` |
| | `cross3`, `dot3`, `dotN`; `clamp`; `median` (sorts its argument in place) | no throw |
| | prepared `matrix3d` transport: `requirePreparedMatrix4`, `readPreparedMatrix4`, `multiplyPreparedMatrix4`, `preparedRotationMatrix4`, `invertPreparedAffineMatrix4`, `transformPreparedPoint`, `serializePreparedMatrix4` | `Prepared projection requires …`, `Prepared rotation axis is invalid.`, `Prepared material parent became singular.` |
| | `isArray`, `canonical` (recursively key-sorted copy for stable digests), `flagValue`, `positionalArguments` | no throw |
| `@cssearth/core/schema` | structural guards: `object`, `array`, `tuple`, `union`, `literal`, `json`, … and `parse` | `Invalid <label> structure at <path> (<value>).` |
| `@cssearth/core/node` | `sha256` (hex digest of text as UTF-8 or of bytes), `sha256File` (streamed, with byte count), `projectRoot` (nearest ancestor with `pnpm-workspace.yaml`) | Node only |

Getters take at most two parameters, so `requireArray(rows).map(requireString)` works and names a
failing element by its index. `shape` keeps fields it does not decode; its default context is
`Terrestrial source`, the wording the source records have always reported.

```text
packages/core/
├── src/           validate.ts, decode.ts, schema.ts, is-array.ts, canonical-value.ts, cli-arguments.ts and tests
│   ├── math/      vector3.ts, matrix.ts, scalar.ts, statistics.ts
│   └── node/      hash.ts, project-root.ts: the Node-only entry
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

ESM, CommonJS and declarations are built with tsup, like the other packages. From the repository root:

```sh
pnpm --filter @cssearth/core build
pnpm --filter @cssearth/core typecheck
pnpm --filter @cssearth/core test
```
