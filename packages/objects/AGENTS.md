# Objects package instructions

Own the shared object JSON parser, validation, reusable object types, and preparation contracts.
Own the source catalogue (`src/sources/`, browser-safe), the provenance, exploration and source-usage records the
application reads and preparation writes (`src/provenance/`, the browser-safe `@cssearth/objects/provenance` entry; the
application's dataset routes come in as `DatasetRoutes`, never named here), the
source-manifest format, preparation's read of the registry and the runtime asset closure that owns each object's
inventory (`src/node/`, the Node-only `@cssearth/objects/node` entry); the main, `sources` and `provenance` entries never
import `node/`.
`src/node/contract/` is the Node-only `@cssearth/objects/node/contract` entry: the helpers tests use to check an object
against its contract (its final prepared definition, and fixture values required before a test inspects them).
`src/node/source-test.ts` is the Node-only `@cssearth/objects/node/source-test` entry for tests that need restored object sources.
An object type describes supported behavior and data, not an individual planet.
Do not ship per-object configuration, generated payload modules, shell content, or renderer code here.
Keep one shared object contract; application discovery remains in the existing registry.
`src/registry/` holds that registry's shared contracts, exported from the main entry: the entry schema and catalogue
decoding (`defineObjects`, `catalogEntry`, `catalogueObject`), the discovery, distance, arrival, prepared-focus and overview parsers, the classification
categories, the fact order, the destination-name normalisation preparation and search share, the context colour and
world-rotation validation. `site/objects.mts` stays the one `OBJECTS` registry: it binds these contracts to the shell's
scene loader. The registry here never loads a scene, reads a file or lists an object. Preparation reads that same
registry with `readPreparedObjects` (`src/node/prepared-registry.ts`): the prepared catalogue decoded with the same
contracts, without a scene loader. It is a read of the one registry, never a second list; keep it assembled as
`site/objects.mts` assembles `OBJECTS`. The catalogue is prepared from the object folders themselves: `readCatalog` and
`readContextObjects` (`src/node/catalog-directory.ts`) read the descriptors that opt into the catalogue and the context objects
without an entry, and `readOverviews` the levels of the zoom ladder a package authors under `properties.overview` (its zoom thresholds and framing, the classifications it holds, the packages it draws), refusing two levels with one order or one classification; the caller passes the navigation distance in (`prepareSceneDistance` in `@cssearth/bake/navigation`).
Preparation must remain reproducible from source inputs and provenance outside packages.

## Shared package contract

- Packages are renderer agnostic: no CSS/DOM rendering, application shell, or renderer-specific types.
- No per-object folders, planet-specific implementations, or branches on named object IDs.
- Keep object JSON, source inputs/manifests, licences, required notices, provenance, and prepared payloads outside packages.
- Shared parsers validate versioned JSON into reusable object types and capability data.
- Objects using the same capabilities use the same implementation and differ through their JSON.
- Preparation and rendering use explicit interfaces; concrete renderer implementations live outside packages.
- Capabilities must compose so complex objects can add prepared layers or paging without planet-specific forks.
- The shared scene and navigation contract covers every prepared object and future object type, independently of navigation-menu membership.
- Scientific reference tables belong to astronomy/catalog; object presentation customizations do not.

## Source size and package maintenance

- Use strict TypeScript and validate external unknown values; no `any` or TypeScript suppression comments.
- Every source file, test, tool, and generated source is limited to 600 physical lines, including blanks/comments.
- `pnpm lint:packages` enforces the limit. Split code by responsibility; keep bulk prepared data outside source code.
- Maintain README.md and CLAUDE.md as a symlink to this guide. Test behavior and package boundaries.
