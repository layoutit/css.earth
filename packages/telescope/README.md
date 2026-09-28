# @cssearth/telescope

The telescope library: product records, PDS label reading, target resolution, and the clients of the archives and pinned
Python astronomy packages that the telescope command ([`@cssearth/telescope-cli`](../telescope-cli/README.md), whose README
is the command guide) and the workspace's archive and preparation tools share. It is a workspace interface, not a supported
npm one.

## Library

The library is archive-neutral. It is built by `pnpm build:telescope` and imported by name.

| entry | what it holds |
|---|---|
| `@cssearth/telescope` | product records (`PRODUCT_RECORD_SCHEMA`, `EVIDENCE_KINDS`, `parseProductRecord`, `productRecordPath`, `evidenceFor` and the record types); PDS3 and PDS4 label reading (`pds3Keyword`, `pds3Values`, `pds3TimeIso`, `pds4Elements`, `pds4Blocks`, `pds4Block`, `pds4Field`, `pds4Number`, `pds4ProductIdentity`, limits in [PDS labels](../../docs/pds-labels.md)); target-name resolution against the shipped catalogue (`resolveTarget`, `withRequestedTargetName`, `canonicalTargetRequest`, `TargetCatalogueEntry`). No Node built-ins. |
| `@cssearth/telescope/node` | product records on disk (`writeProductRecord`, `readProductRecord`, `sameRun`, `runDigest`, `addProductEvidence`, `assertInputPins`, `fileSize`); the process boundary into the pinned Python astronomy packages (`astroquery`, `tapRows`, MAST, PDS, pyuvdata, science, plots, projection, transit, starry and SPIDERMAN clients); the ESO archive's raw-frame table, headers and downloads, the esorex runner and the calselector association trees (`queryRawTable`, `rawFrames`, `esoHeader`, `runRecipe`, `associationTree`); their installers; the VO metadata contracts; SIMBAD sky targets for names the catalogue does not ship (`resolveSkyTarget`, `parseSkyTarget`, `skyRegion`, `skyCatalogueEntry`); cited MAST target associations (`loadTargetAssociations`, `parseTargetAssociationSources`); inline Python under a pinned toolchain with a memory ceiling (`toolchainPython`, `freeMemoryPercent`); and `PACKAGE_ROOT`, `TOOLCHAINS`, `WORKSPACE`. |

The pinned toolchains are in [`toolchains/`](toolchains/): each descriptor, its hash-locked requirements, the licences and
notices of what it installs ([NOTICE.md](toolchains/NOTICE.md)), and the [package ownership map](toolchains/ownership.json).
Install or check one with `node packages/telescope-cli/src/toolchains/astronomy-toolchains.mts astroquery|pds|starry|spiderman install|verify`.
A descriptor's or lock's bytes are the identity of an installed environment: changing any of them asks every checkout to
reinstall.

What stays outside the package: the telescope command (`@cssearth/telescope-cli`) with each archive's clients, reducers and
ledger builders and the ledger machinery they share, the archives' pinned programs and toolchain pins
(beside the archive's code in `packages/telescope-cli/src/archives/<archive>/`, or `tools/objects/<archive>/` for the
archives not yet moved), and every object-specific use of a product.
