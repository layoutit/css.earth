# @cssearth/catalog

The `.gxct` packed-column binary format used by [cssEarth](https://github.com/layoutit/cssEarth) for point catalogues — stars, galaxies, exoplanets.

Zero dependencies. Numeric columns are typed-array views over the original buffer, so a catalogue goes from `fetch` to GPU buffer with no copy and no parse pass.

```bash
npm install @cssearth/catalog
```

```ts
import { readCatalog } from '@cssearth/catalog'

const buffer = await fetch('/data/catalogs/stars/v1/stars.gxct').then((r) => r.arrayBuffer())
const stars = readCatalog(buffer)

stars.count                 // 117955
stars.numeric('posPc')      // Float32Array, 3 components per row, no copy
stars.strings('name')[42]   // decoded lazily
```

The byte-level spec is in [FORMAT.md](./FORMAT.md). The Python writer lives in the external catalogue pipeline (not part of this repository); `pnpm check:parity` proves the two implementations agree.

## Source size

All source files, tests, tools, and generated code are limited to 600 physical
lines. Run `pnpm lint:packages` from the repository root. Package instructions
live in AGENTS.md; CLAUDE.md links to the same file.
