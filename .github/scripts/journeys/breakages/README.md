# Rebuilt-copy breakages

The applier accepts only a named sibling of the current checkout. It resolves paths, rejects symlink escapes and shared hard links, and validates every exact substitution before writing. Reapplying fails closed. Sources in the harness checkout stay untouched.

Use a separate clean sibling per specification. The build supervisor refuses existing copies, clones the restored checkout and dependencies, applies the substitution, and runs one production Astro build. Status and logs stay under `output/journeys/builds/<id>/`; `complete` requires exit zero and nonempty route HTML. Inspect status before recording. Build copies are removed after evidence capture.

```sh
set -eu
cd "$HARNESS_CHECKOUT"
export TMPDIR="$PWD/output/tmp"
export ASTRO_TELEMETRY_DISABLED=1 TELEMETRY_DISABLED=1
mkdir -p "$TMPDIR" output/journeys
node .github/scripts/journeys/breakages/build-copy.mts control
node .github/scripts/journeys/breakages/build-copy.mts dependent-order
node site/journeys/run.mts --checkout "$PWD-proof-control" --dist "$PWD-proof-control/dist-proof" --out output/journeys/order/control --journey milky-way --profile chromium-desktop --repeat 2
node site/journeys/run.mts --checkout "$PWD-proof-dependent-order" --dist "$PWD-proof-dependent-order/dist-proof" --out output/journeys/order/broken --journey milky-way --profile chromium-desktop --repeat 2
node site/journeys/compare.mts --base output/journeys/order/control/run-1 --head output/journeys/order/broken/run-1
# The broken comparison must return 1. Save its output before deleting both siblings.
```

The order proof changes only the issue order of the startup request batch, keeping its URL set and response sources. This is a declared issue-order contract; it does not invent a completion dependency among parallel fetches. World completion before router import is a separate real causal declaration. The guide records the measured detector families and any unproved result.

`dropped-listener` removes the search keydown listener. Assertions save an errors row, partial trace and focused content. `reduced-motion` changes CV Mon's prepared native opacity permission. `webkit-path` is a synthetic engine-specific startup fault, not evidence of a naturally occurring browser branch. See [the journey guide](../../../../docs/site-journeys.md) for coverage and limitations.

## Equal-artifact engine control

The engine-control tool assembles two healthy views and one fault view of a completed local distribution. Unchanged prepared files are shared read-only by symlink; the actual startup module and its hidden map are independent files. The map shifts generated positions by the inserted line while retaining original positions. Healthy copies are identical; the fault changes one byte, `0` to `1`, in an equal-length Safari/WebKit-only tripwire. This avoids rebuild names and byte-size drift without changing comparison. It proves a synthetic startup exception, not a naturally occurring engine-specific branch. Existing output roots are refused. Browser proof still requires exact healthy repeats, an exact independent healthy comparison in each engine, an exact Chromium fault comparison, and an errors-family difference in WebKit.
