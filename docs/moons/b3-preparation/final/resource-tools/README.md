# Serial B3 replay

From the repository root, run `python3 docs/moons/b3-preparation/final/resource-tools/browser-serial.py`. It runs one body/view/DPR per browser and server lifetime, closes both, and only then starts the next. It stops at the first failure. The process monitor checks the descendant RSS and global free-memory signal; it terminates only descendants of its own command. RSS is a polled stop threshold, not an allocation limit.

The default replay reruns all 34 cases. `B3_RESUME=1` permits reuse of passing local receipts; always follow it with `python3 docs/moons/b3-preparation/final/collect-browser-evidence.py`, which rejects missing cases and changed shared/source/prepared bytes. Generated logs and fresh captures stay under ignored `output/` paths. The capture harness records exact source, prepared and actual response hashes.

To run only one view: `B3_LENS=geology B3_DPR=1 python3 docs/moons/b3-preparation/final/resource-tools/run-bounded.py titania-geology node docs/moons/b3-preparation/final/resource-tools/browser-one.mjs titania`.

Do not run a build, another browser task, or another test suite alongside these commands. No Node heap override or system-wide process changes are used.
