# Proposed repository shape

Target only. The visual experiment does not move application files.

```text
packages/
├── astronomy/src/               # units, time, reference frames
├── catalog/src/                 # scientific catalog formats and validation
├── engine/src/                  # observer, flights, lifetime, scale policy
└── objects/src/                 # capabilities, reusable geometry/pixel preparation
    # Each package: README.md, AGENTS.md, CLAUDE.md → AGENTS.md
    # Strict TypeScript, guarded imports, maximum 600 physical lines per source file

src/
├── objects/                     # eventual rename of src/planets; not needed for proof
│   ├── mercury/                 # same self-contained layout as below
│   ├── venus/
│   ├── earth/                   # richer JSON capabilities; same ownership
│   └── milky-way/
│       ├── object.json          # authored identity + representation recipe
│       ├── source/              # inputs, manifests, recipes, provenance/licences
│       ├── prepared/            # reproducible runtime manifests + canonical bank
│       └── NOTICE.md
├── catalogs/                    # datasets shared by many objects
│   ├── stars/{source,prepared}/
│   └── deep-sky/{source,prepared}/
├── renderers/css/
│   ├── runtime/                 # retained DOM, input, CSS transforms, resource binding
│   └── preparation/             # offline CSS plans/atlas addressing
└── preparation/
    ├── raster/                  # concrete image codecs and file adapters
    └── catalogs/                # concrete scientific-source ingestion adapters

site/
├── pages/                       # routes and metadata
├── components/                  # shared shell, navigation, controls
└── runtime/                     # application composition, registry, providers, policy
tools/                          # thin TypeScript commands: prepare, acquire, verify
tests/                          # cross-layer integration, browser and visual oracles
public/                         # generated serving mirror; never the source of truth
docs/architecture/              # decisions and diagrams
experiments/milky-way/           # current isolated proof; not a production renderer
```

```text
Current ownership                    Final ownership
──────────────────────────────────────────────────────────────────────
src/platform/                        removed after the last consumer migrates
  pure camera/lifetime algorithms    packages/engine/
  browser + CSS behavior             src/renderers/css/runtime/
  generic preparation algorithms     packages/objects/
  Node/image adapters                src/preparation/

tools/ reusable implementations      packages/* or the appropriate src/ adapter
tools/ command composition           tools/ (TypeScript)
src/planets/<id>/                    src/objects/<id>/ (deferred directory rename)
```

An object folder is needed only for authored detail or a prepared asset bank.
Catalog-only stars and galaxies remain records; they do not each need a folder.
An image bank and depth layers are candidate capabilities, not approved guarantees.
The experiment's pinned reference images remain local under `.local/milky-way-proof/`.
