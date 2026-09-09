# Fresh B2 source restoration proposal

The one-off helper is `/tmp/b2-fresh-source-restore.mjs`. It calls the existing exported `restoreMissingSources`, `publishPinnedSource` and `verifySources` APIs from `tools/objects/dist/operations.js`; it does not implement downloads, transformations or scientific decoders. The existing CLI derives its source destination from the checkout, so the helper supplies the API's explicit `sourceRoot` instead.

The current 13-package inventory contains 424 declared entries. There are **134 ignored entries / 3,356,830,813 bytes**, with 133 authored direct-download operations and one authored Enceladus DSK-to-OBJ ZIP conversion. **290 tracked entries / 50,089,374 bytes** must be copied individually to satisfy complete source inventory, including context/title/catalog metadata, retained GIS files, source labels, assessment PDFs and Titan's tracked comparison grids. Source manifests add roughly 0.2 MB. All expected lengths and SHA-256 pins are retained in `/tmp/b2-fresh-source-feasibility-inventory.json`; final script execution calculates current totals again and rejects mismatching tracked pins before any downloads.

The 134 ignored entries include existing shared/static and photographic sources required by the packages, as well as B2 scientific inputs. A comparison with pre-B2 `98ef3269` finds 33 new or changed ignored pins / 457,226,294 bytes; that delta includes incoming-main additions and is not a complete measure of B2 scientific work because several new lenses consume already retained source files. The full run restores every ignored entry, making complete 13-body source closure possible without links to existing caches or another checkout. No original ignored file is read or copied.

## Run after the root assigns the serial slot

No helper run or download has occurred. Syntax-only `node --check` passed. Source metadata must be frozen and the preparation bundle must reflect the final integrated code before running. Check and announce free disk and destination first. The helper independently refuses to start below 25 GiB free and warns below 60 GiB. Expected retained output is approximately **3.41 GB**, plus report/manifest bytes and small temporary conversion overhead. The largest individual download is 518,340,175 bytes; the existing download API buffers each file. No heap flags or process tuning are added.

Use the already installed Python interpreter that reproduced `docs/moons/b2-preparation/enceladus-dsk-reproduction.json`: SpiceyPy 6.0.3, CSPICE_N0067 and NumPy 2.3.5. Set `CSSEARTH_SPICE_PYTHON` to that interpreter; the helper verifies versions before downloading and never installs packages. Its exact existing path is being confirmed with the Saturn lane.

```sh
export PATH=/Users/ekrof/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
node /tmp/b2-fresh-source-restore.mjs \
  --project=/Users/ekrof/fed/cssEarth-pluto-small-moons \
  --destination=/tmp/moons-b2-fresh-sources-final
```

Without `--restore`, this only reads tracked metadata and prints the plan; it does not create a destination or contact the network. Once the root's scheduling slot and Python path are set, use the same command with `--restore` appended. The destination must be absent or an empty real directory. All source trees are created under `sources/<body>/`; the report remains outside source inventory at `report.json`. Python conversion scratch is scoped to `transform-tmp/` within that destination. No new Git checkout, runtime asset directory or existing-assets link is created.

The script freezes all tracked bytes and pins before requesting sources, preserves authored request headers and operation order, restores one body at a time, then invokes the ordinary exact inventory/byte/hash verifier. Each body's failure is retained; other independent bodies can finish. It exits nonzero unless all 13 complete. A failed run leaves its own evidence and partial source tree intact; no unrelated files or existing source inputs are touched.

## Remaining feasibility boundaries

Every ignored path currently has an authored operation; no unsupported restoration path was found. Enceladus's DSK must be downloaded before its transform, and that ordering is present. Its expected 10,207,923-byte ZIP is validated by the normal pin publisher. All other ignored paths are direct HTTPS downloads without encoding transformations. This bounded wrapper rejects additional operation kinds or new encoded transports so scope cannot silently grow.

Availability is unproven until the fresh requests succeed. Archive HTTP failures, changed remote bytes, Python dependency mismatch, metadata changes during final integration, or a stale bundle can still block the run. Report those actual results; cached source verification and this source-plan inspection do not establish restoration or reproducibility.
