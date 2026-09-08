# Production drag traces

Captured on code revision 5042c066, Chrome 152.0.7977.76, headless hardware-accelerated Chrome on Apple M3 Max (Mac15,11, 36 GiB), 1440 × 900 CSS pixels with emulated DPR 1 and 2. These are local shared-workstation measurements, not a device-wide performance guarantee.

Every run starts from the default view with Shadows enabled, waits for mounted assets, then performs three vertical drags with 60 pointer steps per leg. No wheel input or comet activity overlay is involved. The actual production build has diagnostics disabled.

| Comet | DPR | Median draw interval, ms | p95, ms | Maximum, ms | Largest main-thread task, ms | Dropped without presentation |
| --- | --- | --- | --- | --- | --- | --- |
| 67P | 1 | 16.66 | 18.37 | 60.46 | 47.05 | 2 |
| 67P | 2 | 16.66 | 18.50 | 62.91 | 49.29 | 3 |
| Hartley 2 | 1 | 16.71 | 17.99 | 68.45 | 50.66 | 2 |
| Hartley 2 | 2 | 16.75 | 17.86 | 65.04 | 46.53 | 3 |
| Tempel 1 | 1 | 16.74 | 17.70 | 65.81 | 51.09 | 2 |
| Tempel 1 | 2 | 16.72 | 18.03 | 64.54 | 49.78 | 2 |

All six runs preserve the same 26,585 scene nodes, including 1,000 nucleus triangles, with zero console/page errors and zero interaction-time requests. The actual mounted body atlas URLs are the same canonical @2x files at both DPRs and remain unchanged throughout the drag. These node totals include the shared universe context for the 74-object registry. DOM retention and draw cadence do not establish pixel completeness; unresolved Chrome capture anomalies are recorded in [QUALIFICATION.md](QUALIFICATION.md).

Typical draw spacing is near 16.7 ms. The largest individual gaps range from 60.5 to 68.5 ms; this does not establish uninterrupted 60 fps. The reports retain long tasks, draw gaps and Chrome pipeline sequences marked dropped without a recorded full or partial presentation in the interaction window. Those measures are distinct and must not be added together.

Durations include Chrome complete (X) and nested begin/end (B/E) events, clipped to the marked interaction window. Nested spans overlap; category totals must not be summed into a frame budget. Reports include prepared-payload, runtime-inventory and terrain hashes, hashes of actually loaded HTML/JavaScript/body-atlas responses, GPU details, per-category timings and the raw trace hash. Source-mesh hashes and reduction distances are in [GEOMETRY.md](GEOMETRY.md). Frame cadence comes from DrawFrame events; it is not inferred from requestAnimationFrame counts.

Raw compressed traces remain locally under `output/comet-performance/caption-{67p,103p,9p}-dpr-{1,2}/chrome-trace.json.gz`; reports and unmodified production screenshots are checked in under [evidence](evidence). Older captures remain local as historical evidence and are not mixed into this table.

Reproduce after building and serving the static site:

```sh
pnpm build
node tools/preview.mjs --port 4258
# In another terminal, run one body/DPR at a time:
node tests/objects/browser/comet-67p/drag-trace.mjs http://127.0.0.1:4258 1 output/comet-performance/recheck-103p comet-103p
```
