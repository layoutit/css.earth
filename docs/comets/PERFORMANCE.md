# Production drag traces

Captured on code revision a965d046, Chrome 152.0.7977.76, headless hardware-accelerated Chrome on Apple M3 Max (Mac15,11, 36 GiB), 1440 × 900 CSS pixels with emulated DPR 1 and 2. These are local shared-workstation measurements, not a device-wide performance guarantee.

Every run starts from the default view with Shadows enabled, waits for mounted assets, then performs three vertical drags with 60 pointer steps per leg. No wheel input or comet activity overlay is involved. The actual production build has diagnostics disabled.

| Comet | DPR | Median draw interval, ms | p95, ms | Maximum, ms | Largest main-thread task, ms |
| --- | --- | --- | --- | --- | --- |
| 67P | 1 | 16.69 | 18.56 | 63.93 | 50.58 |
| 67P | 2 | 16.71 | 18.53 | 64.95 | 50.81 |
| Hartley 2 | 1 | 16.68 | 18.37 | 66.91 | 50.29 |
| Hartley 2 | 2 | 16.75 | 18.40 | 68.23 | 50.97 |
| Tempel 1 | 1 | 16.68 | 18.55 | 63.04 | 48.73 |
| Tempel 1 | 2 | 16.55 | 18.49 | 63.86 | 49.64 |

All six runs preserve the same 23,400 scene nodes, including 1,000 nucleus triangles, with zero console/page errors and zero interaction-time requests. The actual mounted body atlas URLs are the same canonical @2x files at both DPRs and remain unchanged throughout the drag. These node totals include the shared universe context.

The typical draw spacing is near 60 Hz, but every run has one 63–68 ms draw gap near the beginning. In the 67P DPR 1 trace, the first post-input BeginMainFrame spans 50.57 ms; its largest recorded JavaScript call is 3.29 ms. The trace does not attribute all of that wall time to a single script operation. These initial stalls are retained in the reported maxima.

Durations include Chrome complete (X) and nested begin/end (B/E) events, clipped to the marked interaction window. Nested spans overlap; category totals must not be summed into a frame budget. The machine-readable reports include original-mesh/prepared-payload hashes, hashes of actually loaded HTML/JavaScript/body-atlas responses, GPU details, per-category timings and the raw trace hash. Frame cadence comes from DrawFrame events; it is not inferred from requestAnimationFrame counts.

Raw compressed traces remain locally under `output/comet-performance/production-{67p,103p,9p}-dpr-{1,2}/chrome-trace.json.gz`; reports and unmodified production screenshots are checked in under [evidence](evidence). The captures were analyzed again from those unchanged raw traces to include B/E duration events.

Reproduce after building and serving the static site:

```sh
pnpm build
node tools/preview.mjs --port 4258
# In another terminal, run one body/DPR at a time:
node tests/objects/browser/comet-67p/drag-trace.mjs http://127.0.0.1:4258 1 output/comet-performance/recheck-103p comet-103p
```
