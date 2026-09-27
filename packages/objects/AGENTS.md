# Objects package instructions

Own the shared object JSON parser, validation, reusable object types, and preparation contracts.
Own the source catalogue (`src/sources/`, browser-safe) and the source-manifest format (`src/node/`, the Node-only
`@cssearth/objects/node` entry); the main and `sources` entries never import `node/`.
`src/node/contract/` is the Node-only `@cssearth/objects/node/contract` entry: the helpers tests use to check an object
against its contract (its final prepared definition, and fixture values required before a test inspects them).
An object type describes supported behavior and data, not an individual planet.
Do not ship per-object configuration, generated payload modules, shell content, or renderer code here.
Keep one shared object contract; application discovery remains in the existing registry.
`src/registry/` holds that registry's shared contracts, exported from the main entry: the entry schema and catalogue
decoding (`defineObjects`, `catalogEntry`), the discovery, distance, arrival and prepared-focus parsers, the classification
categories, the fact order, the destination-name normalisation preparation and search share, the context colour and
world-rotation validation. `site/objects.mts` stays the one `OBJECTS` registry: it binds these contracts to the shell's
scene loader. The registry here never loads a scene, reads a file or lists an object.
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
