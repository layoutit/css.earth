# @cssearth/core

Runtime validation and small shared helpers for the browser runtime, the site and the preparation tools. Validation
checks values that arrive from outside the type system (JSON files, prepared payloads, archive records) and returns them
typed, or throws a `TypeError` that names the value. Zero dependencies. The main and `schema` entries use no host
globals and no Node built-ins, so browser bundles can import them; the runtime asset content address and the repository root need Node and live
behind the separate `@cssearth/core/node` entry.

| entry | what it holds | failure |
|---|---|---|
| `@cssearth/core` | `isRecord`, `isPlainRecord`, `isFiniteNumber`, `hasErrorCode` | predicates, no throw |
| | `requireRecord`, `requireArray`, `requireString`, `requireFiniteNumber`, `requirePositive`, `requireBoolean`, `requireNonemptyText` | `<label> must be …` (label defaults to `Source value`) |
| | `checks(failure(prefix))`: `record`, `array`, `text`, `finite`, `positive`, `integer`, `boolean`, `choice`, `unique`, `numbers` | `<prefix><label> must be ….` |
| | decoders: `shape`, `optional`, `nullable`, `array`, `dictionary`, `boolean`, `choice`, `text`, `number` | `<context> <key>: <reason>` |
| | `normalizeOrZero`, `normalize3OrZero`, `normalize3OrZeroNonPositive`, `normalize3Unchecked` | zero/NaN policies named explicitly |
| | `medianUpperMiddle` (copies, upper middle) | `TypeError` for an empty sample |
| | `normalizeOrThrow` | caller-supplied error for zero/NaN length |
| | `cross3`, `dot3`, `dotN`; `clamp`; `medianAveraged` / `median` (sort in place) | no throw |
| | prepared `matrix3d` transport: `requirePreparedMatrix4`, `readPreparedMatrix4`, `multiplyPreparedMatrix4`, `preparedRotationMatrix4`, `invertPreparedAffineMatrix4`, `transformPreparedPoint`, `serializePreparedMatrix4` | `Prepared projection requires …`, `Prepared rotation axis is invalid.`, `Prepared material parent became singular.` |
| | `isArray`, `canonical` (recursively key-sorted copy for stable JSON), `flagValue`, `positionalArguments` | no throw |
| `@cssearth/core/schema` | structural guards: `object`, `array`, `tuple`, `union`, `literal`, `json`, … and `parse` | `Invalid <label> structure at <path> (<value>).` |
| `@cssearth/core/oracle` | Shared oracle fixture validation and input reading; [Python harness](src/node/oracle/README.md) | Node only, ESM only |
| `@cssearth/core/node` | `sha256` (the content address of a published runtime asset, from text as UTF-8 or bytes), `projectRoot` (nearest workspace ancestor), `discoverRoot` (caller-relative marker/package discovery), `discoverGitRoot` (explicit starting directory), `containedPath` (lexical or realpath containment) | Node only |

Getters take at most two parameters, so `requireArray(rows).map(requireString)` works and names a
failing element by its index. `shape` keeps fields it does not decode; its default context is
`Terrestrial source`, the wording the source records have always reported.

Explicit readers accept a caller-owned `Fail`: `readNonArrayRecord`, `readFiniteNumber`, `readTextAllowEmpty`,
`readNonemptyText`, `readNonblankText`, `readPositiveNumber`, `readPositiveInteger` and `readSafeIntegerAtLeast`.
Nonempty text accepts whitespace; nonblank text checks trimming but returns the original string. Positive integers
accept represented integers above the safe range; safe integers do not. These readers are not array-map callbacks.

```text
packages/core/
├── src/           validate.ts, decode.ts, schema.ts, is-array.ts, canonical-value.ts, cli-arguments.ts and tests
│   ├── math/      vector3.ts, matrix.ts, scalar.ts, statistics.ts
│   └── node/      hash.ts, project-root.ts, root-discovery.ts, path-containment.ts: the Node-only entry
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

ESM, CommonJS and declarations are built with tsup, like the other packages. From the repository root:

```sh
pnpm --filter @cssearth/core build
pnpm --filter @cssearth/core typecheck
pnpm --filter @cssearth/core test
```

Shared world rotation/reflection types and validation live in `src/math/world-rotation.ts`, used by objects parsers and engine navigation.
