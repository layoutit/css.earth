# Production drag traces

[HALLEY.md](HALLEY.md#production-drag-traces) records the fifth comet's current
production measurements alongside freshly captured 67P controls at DPR 1 and 2.
Those runs use the 76-object registry; the table below retains its historical scope.

The Wild 2 measurements below describe the original 996-leaf open surface. Its current 992-leaf completed model and replacement measurements are in [WILD2-COMPLETION.md](WILD2-COMPLETION.md). Measurements for the other three comets remain applicable.

Captured against evidence revision **c94c7abe**, whose application code and prepared runtime bytes are unchanged from the final **67217245** build. Chrome 152.0.7977.76, headless hardware-accelerated Chrome on Apple M3 Max (Mac15,11, 36 GiB), 1440 × 900 CSS pixels with emulated DPR 1 and 2. These are local shared-workstation measurements, not a device-wide performance guarantee.

Every run starts from the default view with Shadows enabled, waits for mounted assets, then performs three vertical drags with 60 pointer steps per leg. No wheel input or comet activity overlay is involved. The actual production build has diagnostics disabled.

| Comet | DPR | Median draw interval, ms | p95, ms | Maximum, ms | Largest main-thread task, ms | Dropped without presentation |
| --- | --- | --- | --- | --- | --- | --- |
| 67P | 1 | 16.71 | 18.38 | 62.19 | 48.20 | 2 |
| 67P | 2 | 16.70 | 18.49 | 59.99 | 46.24 | 2 |
| Hartley 2 | 1 | 16.82 | 18.77 | 67.03 | 49.72 | 8 |
| Hartley 2 | 2 | 16.79 | 18.64 | 68.97 | 50.96 | 6 |
| Tempel 1 | 1 | 16.64 | 18.53 | 65.61 | 50.25 | 2 |
| Tempel 1 | 2 | 16.61 | 18.49 | 49.09 | 34.05 | 1 |
| Wild 2 | 1 | 17.36 | 21.63 | 68.84 | 49.70 | 27 |
| Wild 2 | 2 | 16.75 | 19.84 | 68.79 | 49.44 | 12 |

All eight runs retain every scene node, with zero console/page errors and zero interaction-time requests. 67P, Hartley 2 and Tempel 1 each mount 26,830 scene nodes including 1,000 nucleus triangles; Wild 2 mounts 26,826 including 996 observed-surface triangles. These totals include the shared universe context for the 75-object registry. The actual mounted body atlas URLs are the same canonical @2x files at both DPRs and remain unchanged throughout each drag.

Median draw spacing ranges from 16.6 to 17.4 ms. Wild 2's p95 is 19.8–21.6 ms, and its two runs record 27 and 12 pipeline sequences dropped without a recorded presentation. Individual draw gaps across the four comets reach about 69 ms. These measurements do not establish uninterrupted 60 fps. DOM retention also does not prove every-frame pixel completeness; separate visual and source-fidelity limits are in [QUALIFICATION.md](QUALIFICATION.md) and [GEOMETRY.md](GEOMETRY.md).

Wild 2 retains the 996-face budget after its 1,292- and 1,494-face development trials showed substantially slower draw cadence. Those trials improve sampled geometry distances and remain in the [budget decision](evidence/81p-budget-decision.json); they are not mixed into the production table. Each selected body atlas is 1,024 × 4,032 pixels, or 16,515,072 bytes as RGBA; the two Wild 2 lighting banks total 33,030,144 calculated RGBA bytes. Native u leaves have 64 × 64 raster cells before their prepared transforms. Calculated pixel storage is not measured GPU residency.

The complete Wild 2 runtime inventory is 7,219,814 installed bytes. All four inventories together are 29,322,242 bytes in 130 files, verified through fresh downloads. These per-object installation totals exclude prepared JSON transport and shared shell/navigation/universe files; they are not a measured full-scene cold network transfer.

Durations include Chrome complete (X) and nested begin/end (B/E) events, clipped to the marked interaction window. Nested spans overlap; category totals must not be summed into a frame budget. Reports include prepared-payload, runtime-inventory and terrain hashes, hashes of actually loaded HTML/JavaScript/body-atlas responses, GPU details, per-category timings and the raw trace hash. Current prepared files and loaded atlas records were checked against all eight reports. Frame cadence comes from DrawFrame events; it is not inferred from requestAnimationFrame counts.

Raw compressed traces remain locally under `output/comet-performance/final-{67p,103p,9p,81p}-dpr-{1,2}/chrome-trace.json.gz`; reports and unmodified production screenshots are checked in under [evidence](evidence). Older captures remain local as historical evidence.

Reproduce after building and serving the static site:

```sh
pnpm build
node tools/preview.mjs --port 4258
# In another terminal, run one body/DPR at a time:
node tests/objects/browser/comet-67p/drag-trace.mjs http://127.0.0.1:4258 1 output/comet-performance/recheck-81p comet-81p
```
