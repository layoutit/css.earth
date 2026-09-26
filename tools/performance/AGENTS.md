# Connected iPad journeys

Use `pnpm ipad:run` for repeatable cssEarth interactions on the dedicated iPad. Read the command examples and output contract in [README.md](README.md#repeatable-journeys-on-the-connected-ipad).

- Run against a performance-mode **built preview** on the Mac LAN. The command checks the preview's checkout and build, opens the start route in visible iPad Safari, records the journey, and closes its own Safari automation context.
- Name flights by object (`--start earth --fly lutetia`). The harness calls the app's scene router, then verifies the destination route is ready and visible. Do not automate search-result markup or substitute a direct URL change for the flight.
- `--tap`, `--drag`, `--zoom`, and `--type` dispatch page input through Web Inspector. The native iPad screenshots are real device frames; those input events are **not** native touch. iOS 26.6 on this device refuses CoreDevice HID remote control. Keep that distinction in reports.
- Use the retained pymobiledevice3 library worker for Safari launch and screen frames. Do not open hidden automation windows, hunt through tabs, or use QuickTime as a capture workaround.
- A valid visual journey has a successful command, the requested route in `report.json`, native frames in `screens/`, and an inspected `filmstrip.png`. A step acknowledgement alone is insufficient. Report an incomplete capture as incomplete, even if the app reached its destination.
- When a command is slow, read its printed stage timings before retrying. Stop a stuck run and verify its worker and temporary Safari context closed. Do not keep launching duplicate sessions.
- Keep generated traces and screenshots under ignored `output/`. Do not commit them as completion reports. Speak to the user in English.
