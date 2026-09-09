"""Task-local process monitor. One command; stop its descendants before pressure grows."""
import json, os, pathlib, signal, subprocess, sys, time

label, *command = sys.argv[1:]
out = pathlib.Path.cwd() / "output/b3-resume"
out.mkdir(parents=True, exist_ok=True)
receipt = {"command": command, "limitRSSBytes": min(6 * 1024**3, int(os.environ.get("B3_RSS_LIMIT_BYTES",6 * 1024**3))), "minimumFreePercent": 30,
           "timeoutSeconds": 900, "peakRSSBytes": 0, "samples": [], "status": "RUNNING"}
env = os.environ.copy()
env["PATH"] = "/Users/ekrof/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:" + env["PATH"]
log = (out / (label + ".log")).open("w")
child = subprocess.Popen(["nice", "-n", "10", *command], stdout=log, stderr=subprocess.STDOUT,
                         env=env, start_new_session=True)
started = time.monotonic()
last_pressure = 0
free = 100
def descendants():
    rows = {}
    for line in subprocess.check_output(["ps", "-axo", "pid=,ppid=,rss="], text=True).splitlines():
        pid, ppid, rss = map(int, line.split())
        rows[pid] = (ppid, rss * 1024)
    owned = {child.pid}
    while True:
        expanded = owned | {p for p, (parent, _) in rows.items() if parent in owned}
        if expanded == owned:
            break
        owned = expanded
    return {pid: rows[pid][1] for pid in owned if pid in rows}
def stop():
    for sig in [signal.SIGTERM, signal.SIGKILL]:
        for pid in reversed(list(descendants())):
            try: os.kill(pid, sig)
            except ProcessLookupError: pass
        time.sleep(1)
try:
    while child.poll() is None:
        rss = sum(descendants().values())
        if time.monotonic() - last_pressure > 2:
            pressure = subprocess.check_output(["memory_pressure", "-Q"], text=True)
            free = int(pressure.rsplit(":", 1)[1].strip().removesuffix("%"))
            last_pressure = time.monotonic()
        elapsed = round(time.monotonic() - started, 1)
        receipt["peakRSSBytes"] = max(receipt["peakRSSBytes"], rss)
        receipt["samples"].append({"seconds": elapsed, "rssBytes": rss, "freePercent": free})
        if rss > receipt["limitRSSBytes"] or free < receipt["minimumFreePercent"] or elapsed > 900:
            receipt["status"] = "STOPPED_RESOURCE_BOUND"; stop(); break
        (out / (label + ".json")).write_text(json.dumps(receipt, indent=2) + "\n")
        time.sleep(0.25)
    code = child.wait(timeout=10)
    if receipt["status"] == "RUNNING": receipt["status"] = "PASS" if code == 0 else "FAIL"
    receipt["exitCode"] = code
except BaseException:
    receipt["status"] = "INTERRUPTED"; stop(); raise
finally:
    receipt["seconds"] = round(time.monotonic() - started, 1)
    (out / (label + ".json")).write_text(json.dumps(receipt, indent=2) + "\n")
    log.close()
    print(json.dumps({k: v for k, v in receipt.items() if k != "samples"}), flush=True)
sys.exit(0 if receipt["status"] == "PASS" else 1)
