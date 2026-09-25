# @cssearth/bake

The repository's build-time preparation code. The preparation tools (`src/preparation`, the renderer's
`preparation/` compilers, `tools/nebula`, `tools/objects`, `tools/assets`) and the nebula lab import it to turn source
records into prepared delivery. The application never imports it: the runtime reads only what the bake wrote.

Each topic is one subpath entry, and topics don't import each other. The first topic is the volume bake, which was the
nebula lab's `volume-core` and `volume-bake` packages until 2026-09.

| entry | what it holds | host |
|---|---|---|
| `@cssearth/bake/volume` | contracts: volume recipes, slices, frames, emission, compiler controls and bake results, render-element budgets, observation photos and mappings, sampled recipes, shape scenes, simulation priors, prepared catalogue stars | host-neutral: no Node built-ins, DOM or native codecs, so the lab's browser viewer imports it too |
| | coordinates: catalogue positions, the compiler frame, density placement, observer tangents, overlay alignment, placement, registration and WCS | |
| | fields: finite emission and its windows, sampled density, diffuse atoms, cloud density, density projection, photometric MGE and emission, observation priors, simulation envelopes, authored shapes | |
| | materials: cloud appearance and detail, component and slab materials, sampled colour, display colour, star photometry | |
| | sampling: registered RGB/scalar rasters and layer optimization | |
| `@cssearth/bake/volume/node` | compact inputs: replay of compact compiler, sampled, symmetry, finite-emission and simulation-prior inputs, density grids and windows, pinned file I/O | Node only (`node:*`, `sharp`) |
| | slices: offline XYZ density, emission, material and painted-field slices and their raster encoding | |
| | compiler: the target-neutral compiler bake, component layouts and retained materials | |

Every entry validates what it reads and fails with a `TypeError` or `RangeError` naming the rule, such as
`Invalid retained render-element profile.` A replay that would change an accepted bake fails instead of writing it,
for example `Compact sampled replay changed accepted <lens> volume`.

```text
packages/bake/
├── src/volume/    contracts/, coordinates/, fields/, materials/, sampling/ and their tests: `@cssearth/bake/volume`
│   └── node/      compact-inputs/, compiler/, slices/ and their tests: `@cssearth/bake/volume/node`
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

The nebula boundary checks (`pnpm check:nebula-boundaries`, from `tools/nebula/package-boundaries.mts` and
`inbound-boundaries.mts`) keep the old packages' guarantees on this entry: the runtime closure imports nothing from
`@cssearth/bake`, the lab's reconstruction and viewer packages may import `@cssearth/bake/volume` but not its node
entry, the main volume entry imports no platform dependency, and no volume source names an object, an object path or
another topic.

`pnpm --filter @cssearth/bake build` writes `dist/`; `pnpm --filter @cssearth/bake test` runs the package's tests
(Vitest) from the repository checkout, since two of them replay tracked compact inputs under `src/objects/`.

## Evidence

The volume entries replaced the lab's `volume-core` and `volume-bake` packages at `5b05729dd9`, moving their sources
unchanged apart from import paths. The outputs were compared byte for byte with those of the packages at `c83b4e4f18`:

- The lab's density bake of `labs/nebula/models/{lmc,smc}/full-density` wrote the same 292 files.
- `pnpm prepare:volume` for the Milky Way (192 prepared files) and `prepare-stars` for the stellar neighbourhood
  (4 files) wrote identical files.
- `tools/nebula/prepare.mts` for the eleven deliveries that bake wrote identical files, except each `delivery.json`
  receipt's `implementationSha256`. That identity hashes the owners by package-relative name, and the name changed from
  `@cssearth/volume-core`/`@cssearth/volume-bake` to `@cssearth/bake`. With main's identity substituted, every
  `delivery.json` matches main's bytes. LMC and SMC record no such identity and matched entirely. M1 fails on both
  commits with the same error (`Compact sampled replay changed accepted hubble-optical volume`).
- The 52 moved tests pass under Vitest, and `node labs/nebula/run.mts test` keeps the same six failures as on
  `c83b4e4f18`. `pnpm test:lab` stops at the same density-bake assertion on both commits.
