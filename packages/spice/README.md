# @cssearth/spice

The repository's reader of NAIF SPICE kernels, for the preparation tools. It evaluates SPK ephemerides and CK pointing
from DAF files, reads text kernels, leap seconds and spacecraft clocks, chains frames, applies light time and stellar
aberration, and assembles the pinhole camera a kernel set places for one photograph. It is a subset of the SPICE toolkit,
checked against SpiceyPy (CSPICE N0067); it interprets no image, product label or prepared payload.

The main entry evaluates bytes (a `Uint8Array`, which a Node `Buffer` is) and kernel text with no Node built-ins, so a
browser bundle could import it. Reading kernels from disk and restoring the pinned mission kernel banks need Node and
live behind the separate `@cssearth/spice/node` entry.

| entry | what it holds | failure |
|---|---|---|
| `@cssearth/spice` | DAF files: `readDaf`, `DAF_RECORD_BYTES` | `Error` naming the rule, such as `Not a DAF file: …` or `DAF must be whole 1024-byte records.` |
| | SPK: `spkSegments` (types 1, 2, 3, 5, 8, 9 and 13), with `propagateTwoBody` for type 5 | `Unsupported SPK segment type …`, `Ephemeris time … is outside …` |
| | CK: `ckSegments` (types 1 to 3), `quaternionToMatrix`, `slerp`, and the 3 × 3 helpers `multiply`, `transpose`, `apply` | `Unsupported CK segment type …`, `Invalid type 3 CK trailer in …` |
| | text kernels: `parseTextKernel`, `parseDateToken`, `numbers`, `strings`, `number`, `string`, `has` | `Kernel pool lacks …`, `Unsupported text kernel date token: …` |
| | time: `parseLeapSeconds`, `utcToEt`, `utcSecondsToEt`, `etToUtc`, `tdbMinusTdt`; clocks: `parseSpacecraftClock`, `encodeClock`, `clockToEt`, `etToClock` | as the text kernels, naming the missing variable |
| | frames: `frameDefinition`, `rotation` (classes 2 to 6), `pckAngles`, `pckRotation`, `tkFrameRotation`, `eulerFrameRotation`, `switchFrameMember`, `rotate`, `identity`, `IAU_BODY_CODES`, `frameStrings` | `Unknown frame: …`, `No PCK orientation for body …`, `No CK pointing for … at ET …` |
| | geometry: `Ephemeris` (states chained through centres, `apparent` with SPICE's `LT`, `LT+S`, `CN` and `CN+S`), `stelab`, `SPEED_OF_LIGHT_KM_S`, `ECLIPTIC_OBLIQUITY_RAD` | `No SPK coverage for body …` |
| | cameras: `spiceCamera`, `pixelModel`, `invert`, `aberrationRotation` | as the kernels it reads |
| | flybys: `parseApproachRecipe`, `spacecraftApproach` (the side a spacecraft approached, from a loaded kernel set) | `TypeError` naming the recipe field |
| `@cssearth/spice/node` | `loadKernelSet`: kernels read in metakernel order into one pool, ephemeris, CK lookups, clocks and frame providers | as the readers, or the file error |
| | kernel banks: `KERNEL_BANK_ROOT`, `kernelBankRoot`, `kernelBanks` (restore, verify and add kernels, bound to a manifest reader), `readPinnedFile` | `Kernel bank … does not declare …`, `Kernel download failed …` |

A kernel bank is one pinned set of a mission's kernels under the checkout's `src/spice/<set>/`. Only its manifest is
committed. The package finds `src/spice` from its own package name, so the path is the same from `src/`, from `dist/`
and from any caller. A bank's `manifest.json` has the shape of a body's source manifest, and that format belongs to the
application, so `kernelBanks` takes the manifest reader as an argument.
[`tools/kernel-banks/kernel-bank.mts`](../../tools/kernel-banks/kernel-bank.mts) binds the banks to
`src/platform/source-manifest.mts` for the preparation tools, and it is also the command line:

```sh
node tools/kernel-banks/kernel-bank.mts acquire <set>        # restore missing kernels, then verify every pin
node tools/kernel-banks/kernel-bank.mts verify <set>         # verify every pin
node tools/kernel-banks/kernel-bank.mts add <set> <url>...   # download, pin and append kernels [--credit] [--license] [--catalogue]
```

```text
packages/spice/
├── src/           daf.ts, spk.ts, two-body.ts, ck.ts, text-kernel.ts, lsk.ts, sclk.ts, frames.ts, geometry.ts,
│   │              camera.ts, approach.ts and their tests
│   └── node/      kernel-set.ts (kernels from disk), kernel-bank.ts and paths.ts (the banks): the Node-only entry
├── AGENTS.md      Package rules
└── CLAUDE.md      Symlink to AGENTS.md
```

## Evidence

The package's tests are self-contained: they build DAF files and text kernels in memory. The comparisons with SpiceyPy
live beside the scripts that write their fixtures in [`tools/oracles/spice/`](../../tools/oracles/README.md):
`dart-draco.oracle.test.mts` (the fifteen pinned DART kernels: time, clock, states with every aberration correction,
every frame class and the DRACO camera), `small-kernel.oracle.test.mts` (one LSK and one PCK) and
`new-horizons-approach.oracle.test.mts` (the approach sides of Pluto and Charon). They need the kernels restored first.

The package replaced the modules under `tools/spice/` at 2254511fde. Its outputs were compared byte for byte with theirs
on every restored kernel of the six banks and on the DART oracle kernels: DAF summaries, SPK states and CK pointing at
ten epochs per segment, leap-second and clock conversions, every kernel frame and PCK body, apparent states, the recipe
cameras of Tethys, Phoebe and Didymos, the Voyager ISS rotations and the Pluto and Charon approaches.
Dawn's bank was only partly restored (50 of its 119 kernels), so the rest of Dawn was not compared. No restored
kernel holds an SPK type 9 segment or a CK type 2 or 3 segment without rates; the package's unit tests cover those types
with synthetic segments.

ESM and declarations are built with tsup. From the repository root:

```sh
pnpm build:spice
pnpm --filter @cssearth/spice typecheck
pnpm --filter @cssearth/spice test
```
