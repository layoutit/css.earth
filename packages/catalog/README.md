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

The byte-level spec is in [FORMAT.md](./FORMAT.md). The Python writer lives in the
external catalogue pipeline. Run `pnpm --filter @cssearth/catalog test` from the
repository root for the TypeScript reader/writer tests. Cross-language parity
needs separate evidence: the retained `scripts/check-parity.mts` runner references
a missing `gen_fixture.py` and cannot currently establish it. See the
[operator notes](AGENTS.md) before changing the format.

`parsePreparedGalaxyCatalog` validates the separate `cssearth-galaxy-catalog@1`
scientific JSON interchange in place. It retains measured distances and errors,
ICRF positions, membership evidence, and source references without producing a
second row bank. It does not change GXCT or infer membership from proximity.
Prepared navigation framing remains distinct from measured half-light radii.

`parsePreparedClusterCatalog` validates the separate `cssearth-cluster-catalog@1`
interchange. Cluster centres carry redshift references and explicit distance
cosmology; R500 proper and comoving apertures remain distinct from cluster edges.
`PreparedCatalogObject` composes galaxy, cluster and nebula records without assigning
galaxy membership to other object types. `parsePreparedNebulaCatalog` validates
source-backed sky centres, distances and classification independently of rendering. Source tables and coordinate preparation remain
outside this package.

## Source size

All source files, tests, tools, and generated code are limited to 600 physical
lines. Run `pnpm lint:packages` from the repository root. Package instructions
live in AGENTS.md; CLAUDE.md links to the same file.
