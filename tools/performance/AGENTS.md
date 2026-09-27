# Connected iPad journeys

Use `pnpm ipad:run` for repeatable cssEarth interactions on the dedicated iPad. Read the command examples and output contract in [README.md](README.md#repeatable-journeys-on-the-connected-ipad).

- Run against a performance-mode **built preview** on the Mac LAN. The command checks the preview's checkout and build, opens the start route in visible iPad Safari, records the journey, and closes its own Safari automation context.
- For the deployed site, use `--live`; it skips the local build and uses the app's existing `objectnavigate` event. Verify the recorded URL and displayed release version. Production may omit internal scene diagnostics; do not apply local preview source maps to it.
- Name flights by object (`--start earth --fly lutetia`). The harness calls the app's scene router, then verifies the destination route is ready and visible. Do not automate search-result markup or substitute a direct URL change for the flight.
- `--tap`, `--drag`, `--zoom`, and `--type` dispatch page input through Web Inspector. The native iPad screenshots are real device frames; those input events are **not** native touch. iOS 26.6 on this device refuses CoreDevice HID remote control. Keep that distinction in reports.
- Use the retained pymobiledevice3 library worker for Safari launch and screen frames. Do not open hidden automation windows, hunt through tabs, or use QuickTime as a capture workaround.
- A valid visual journey has a successful command, the requested route in `report.json`, native frames in `screens/`, and an inspected `filmstrip.png`. A step acknowledgement alone is insufficient. Report an incomplete capture as incomplete, even if the app reached its destination.
- When a command is slow, read its printed stage timings before retrying. Stop a stuck run and verify its worker and temporary Safari context closed. Do not keep launching duplicate sessions.
- Memory investigations use the same journey with `--heap-snapshot`. Inspect `residency.json`, the `WebKit memory MiB` counters and `cssEarth scene released` events in `trace.json`, plus `heap.before.json`/`heap.after.json`. Residency snapshots separate SVG orbit groups from their HTML hosts, and record resource releases and fragment ownership. WebKit category accounting is not process physical footprint. Extend these records when evidence is missing; do not replace them with a growing collection of one-off page probes.
- Keep generated traces and screenshots under ignored `output/`. Do not commit them as completion reports. Speak to the user in English.
- A style spike can come from wheel-listener registration even when the DOM-write log is quiet. Check document/window listener lifetimes at flight boundaries; compare a stable-listener experiment before attributing it to camera transforms or billboard removal.

- Every `ipad:run` export must include `analysis.json`, `analysis.html`, and `slices/` beside the full DevTools trace. Inspect the named handoff/task slices and their native frames before another experiment. If export artifacts are missing, run `node tools/performance/webkit-devtools-trace.mts <capture directory>` on that existing recording; do not recapture it to recover analysis.

- For DOM/compositor mismatches, use `ipad:run --debug`. Inspect `causes.json`, `layers.jsonl`, `compositor-checkpoints.json`, and `analysis.json.compositor`; these record each leaf parent even when it has no native layer. Treat absent, unmapped and unobserved as distinct. Diagnostic overhead makes this a causality capture, not a frame-time benchmark.
