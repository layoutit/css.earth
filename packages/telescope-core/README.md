# @cssearth/telescope-core

The telescope library: product records, PDS label reading, target resolution, and the clients of the archives and pinned
Python astronomy packages that the telescope command ([`@cssearth/telescope`](../telescope-cli/README.md), whose README
is the command guide) and the workspace's archive and preparation tools share. It is a workspace interface, not a supported
npm one.

## Library

The library is archive-neutral. It is built by `pnpm build:telescope` and imported by name.

| entry | what it holds |
|---|---|
| `@cssearth/telescope-core` | product record path and evidence queries (`productRecordPath`, `evidenceFor`; record data and parsing come from `@cssearth/objects`); PDS3 and PDS4 label reading (`pds3Keyword`, `pds3Values`, `pds3TimeIso`, `pds4Elements`, `pds4Blocks`, `pds4Block`, `pds4Field`, `pds4Number`, `pds4ProductIdentity`, limits in [PDS labels](../../docs/pds-labels.md)); target-name resolution against the shipped catalogue (`resolveTarget`, `withRequestedTargetName`, `canonicalTargetRequest`, `TargetCatalogueEntry`). No Node built-ins. |
| `@cssearth/telescope-core/node` | product records on disk (`writeProductRecord`, `readProductRecord`, `sameRun`, `runKey`, `addProductEvidence`, `assertInputs`, `fileSize`); the process boundary into the pinned Python astronomy packages (`astroquery`, `tapRows`, MAST, PDS, pyuvdata, science, plots, projection, transit, starry, SPIDERMAN and PICASO clients (`PICASO_ROOT`, `picasoToolchainSync`, `bobcatNodes`, `diamondbackNodes`, `diamondbackGrid`, `elfOwlNodes`, `elfOwlGrid`, `exoRemNodes`, `exoRemGrid`, `picasoLimbNodes`, `picasoPassband`, `picasoInstalled`, `verifyPicaso`; `PicasoToolchain`, `PicasoGrid`, `PicasoNode`, `PicasoLimbNode`)); the ESO archive's raw-frame table, headers and downloads, the esorex runner and the calselector association trees (`queryRawTable`, `rawFrames`, `esoHeader`, `runRecipe`, `associationTree`); their installers; VO transfer limits and record/product identity queries (metadata and snapshot parsing come from `@cssearth/objects`); SIMBAD sky targets for names the catalogue does not ship (`resolveSkyTarget`, `parseSkyTarget`, `skyRegion`, `skyCatalogueEntry`); cited MAST target associations (`loadTargetAssociations`, `parseTargetAssociationSources`); inline Python under a pinned toolchain with a memory ceiling (`toolchainPython`, `freeMemoryPercent`); and `PACKAGE_ROOT`, `TOOLCHAINS`, `WORKSPACE`. |

The pinned toolchains are in [`toolchains/`](toolchains/): each descriptor, its version-locked requirements, the licences and
notices of what it installs ([NOTICE.md](toolchains/NOTICE.md)), and the [package ownership map](toolchains/ownership.json).
Install or check one with `node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery|pds|starry|spiderman install|verify`.
An installed environment keeps a copy of the descriptor and lock it was built from: when either text changes, every checkout
is asked to reinstall.

`resolveMicromamba()` owns installer bootstrap: `CSSEARTH_TELESCOPE_MICROMAMBA`, then `PATH`, then official release 2.9.0-0 under `USER_ROOT/micromamba/`. The published checksum is fetched and verified in memory before the executable is installed atomically; no checksum file is retained. Conda-forge supplies Python. Async astronomy consumers install missing pins on first use; synchronous preparation consumers retain the explicit installer command.

What stays outside the package: the telescope command (`@cssearth/telescope`) with each archive's clients, reducers and
ledger builders and the ledger machinery they share, the archives' pinned programs and toolchain pins
(beside the archive's code in `packages/telescope-cli/src/archives/<archive>/`), and every object-specific use of a product.

## Path ownership

`src/node/paths.ts` owns `USER_ROOT`, optional `WORKSPACE`, `requireWorkspace()` and package-relative `TOOLCHAINS`. The [command guide](../telescope-cli/README.md) documents platform defaults and workspace admission. Library imports never infer a checkout from the library package's location. Python environments, markers, archive answers and caches are user-owned; shipped pins remain read-only.
