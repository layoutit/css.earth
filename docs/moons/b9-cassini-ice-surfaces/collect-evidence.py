#!/usr/bin/env python3
"""Collect existing B9 evidence; never launch a browser, converter, or build.

Run from any directory after all selected captures and package checks finish:
  B9_CAPTURE_PREFIX=b9-main python3 docs/moons/b9-cassini-ice-surfaces/collect-evidence.py

Successful labels are PREFIX-BODY-qualified-dprN (all three lenses), or the
three PREFIX-BODY-LENS-qualified-dprN split runs. Failed combined runs are
never used. --historical permits checkout drift but records it explicitly;
use a separate --destination for historical evidence. Original report bytes
are preserved, including the original machine paths and CAPTURED_UNREVIEWED
status. This collector does not replace human visual acceptance.
"""

import argparse
import hashlib
import itertools
import json
import os
from pathlib import Path
import re
import shutil


ROOT = Path(__file__).resolve().parents[3]
BODIES = ("tethys", "iapetus", "phoebe")
LENSES = ("normal", "infrared", "ice-absorption")
CAPTURES = Path("output/playwright/b9-surfaces")
MAX_JSON_BYTES = 8 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def pin(path):
    hasher = hashlib.sha256()
    size = 0
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            size += len(block)
            hasher.update(block)
    return {"bytes": size, "sha256": hasher.hexdigest()}


def read_json(path):
    require(path.stat().st_size <= MAX_JSON_BYTES, f"JSON exceeds bounded size: {path}")
    return json.loads(path.read_bytes())


def relative(path):
    return path.resolve().relative_to(ROOT).as_posix()


def safe_path(value):
    path = Path(value)
    path = path if path.is_absolute() else ROOT / path
    require(path.resolve().is_relative_to(ROOT), f"Path escapes repository: {value}")
    return path


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2) + "\n")


def copy_pinned(source, target):
    expected = pin(source)
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        require(pin(target) == expected, f"Refusing to overwrite different evidence: {target}")
    else:
        shutil.copyfile(source, target)
    require(pin(target) == expected, f"Copy mismatch: {source}")
    return expected


def report_for_label(label):
    receipt_path = ROOT / "output/b3-resume" / f"{label}.json"
    log_path = receipt_path.with_suffix(".log")
    receipt = read_json(receipt_path)
    require(receipt.get("status") == "PASS" and receipt.get("exitCode") == 0,
            f"Capture resource gate did not pass: {label}")
    require(log_path.stat().st_size <= MAX_JSON_BYTES, f"Oversized capture log: {label}")
    lines = log_path.read_text().splitlines()
    matches = [line.strip() for line in lines if line.strip().endswith("/report.json")]
    require(len(matches) == 1, f"Expected one report in capture log: {label}")
    report_path = safe_path(matches[0])
    require(report_path.resolve().is_relative_to(ROOT / CAPTURES), f"Unexpected report root: {label}")
    return receipt_path, log_path, report_path, receipt, read_json(report_path)


def selected_reports(prefix):
    selected = []
    for body, dpr in itertools.product(BODIES, (1, 2)):
        full_label = f"{prefix}-{body}-qualified-dpr{dpr}"
        full_path = ROOT / "output/b3-resume" / f"{full_label}.json"
        if full_path.exists() and read_json(full_path).get("status") == "PASS":
            selected.append((body, dpr, set(LENSES), full_label, report_for_label(full_label)))
        else:
            for lens in LENSES:
                label = f"{prefix}-{body}-{lens}-qualified-dpr{dpr}"
                selected.append((body, dpr, {lens}, label, report_for_label(label)))
    return selected


def check_snapshot(snapshot, body, lens, shadows):
    require(snapshot.get("activeObjectId") == body and snapshot.get("selectedObjectId") == body,
            f"Wrong mounted object: {body}/{lens}")
    for key in ("ready", "ownerSame", "retainedStable"):
        require(snapshot.get(key) is True, f"Snapshot {key} failed: {body}/{lens}")
    require(snapshot.get("appError") is None, f"Application error: {body}/{lens}")
    committed = snapshot["lens"]["committed"]
    require(committed["lensId"] == lens and committed["shadows"] is shadows,
            f"Committed lens/lighting mismatch: {body}/{lens}")
    require(snapshot["lens"]["error"] is None and snapshot["lens"]["ready"] is True,
            f"Lens not ready: {body}/{lens}")
    require(snapshot["stats"].get("runtimeGeometryPreparation") is False,
            f"Runtime geometry preparation: {body}/{lens}")
    paint = snapshot["surfacePaint"]
    require(paint["leaves"] > 0 and paint["textured"] == paint["leaves"],
            f"Unpainted retained leaves: {body}/{lens}")
    require(all(x["ready"] for x in snapshot["loadedImages"]), f"Unready image: {body}/{lens}")
    return paint["leaves"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prefix", default=os.environ.get("B9_CAPTURE_PREFIX", "b9"))
    parser.add_argument("--destination", type=Path,
                        default=ROOT / "docs/moons/b9-cassini-ice-surfaces/evidence")
    parser.add_argument("--historical", action="store_true",
                        help="Record checkout-pin differences without qualifying current files")
    parser.add_argument("--source-reproduction", type=Path,
                        help="Explicit successful reproduce-sources.py receipt to retain")
    parser.add_argument("--check", action="append", default=[], type=Path,
                        help="Additional existing bounded JSON receipt to retain (repeatable)")
    args = parser.parse_args()
    require(re.fullmatch(r"[a-z0-9-]+", args.prefix), "Unsafe label prefix")
    destination = safe_path(args.destination)
    require(destination.resolve().is_relative_to(ROOT / "docs/moons/b9-cassini-ice-surfaces/evidence"),
            "Destination must stay in the owned B9 evidence directory")
    runs = selected_reports(args.prefix)
    cases = set()
    captured_pins = {}
    current_cache = {}
    artifacts = {}
    retained = {}
    index = {
        "schema": "cssearth-b9-browser-review-index@1", "capturePrefix": args.prefix,
        "qualification": "Machine evidence only; human visual acceptance is recorded separately.",
        "reports": [], "cases": [], "artifacts": [], "checks": [],
        "limits": ["No compositor FPS or native-renderer parity claim.",
                   "Discrete browser and drag checks do not establish general performance.",
                   "Original reports retain their capture-time paths and unreviewed status."],
    }

    def current_pin(path):
        name = relative(path)
        if name not in current_cache:
            current_cache[name] = pin(path) if path.is_file() else None
        return current_cache[name]

    def add_capture_pin(record):
        name = relative(safe_path(record["path"]))
        expected = {k: record[k] for k in ("bytes", "sha256")}
        require(name not in captured_pins or captured_pins[name] == expected,
                f"Mixed capture source versions: {name}")
        captured_pins[name] = expected

    def artifact(record, keep, label):
        source = safe_path(record["path"])
        name = relative(source)
        require(source.resolve().is_relative_to(ROOT / CAPTURES), f"Unexpected artifact: {name}")
        expected = {k: record[k] for k in ("bytes", "sha256")}
        require(current_pin(source) == expected, f"Capture artifact hash mismatch: {name}")
        if name not in artifacts:
            artifacts[name] = {"originalPath": name, **expected, "path": None}
        if keep:
            key = (expected["sha256"], source.suffix)
            if key not in retained:
                folder = "styles" if source.suffix == ".css" else "screenshots"
                target = destination / folder / (f"{expected['sha256']}.css" if folder == "styles"
                                                 else f"{label}-{source.name}")
                copy_pinned(source, target)
                retained[key] = target.relative_to(destination).as_posix()
            artifacts[name]["path"] = retained[key]

    for body, dpr, lenses, label, run in runs:
        receipt_path, log_path, report_path, receipt, report = run
        require(report.get("schema") == "cssearth-b9-visual-capture@1", f"Unexpected schema: {label}")
        require(report.get("status") == "CAPTURED_UNREVIEWED", f"Incomplete capture: {label}")
        require(report.get("shutdown", {}).get("browserClose") == "COMPLETE", f"Browser not closed: {label}")
        require(len(report["cases"]) == 1, f"Unexpected cohort: {label}")
        case = report["cases"][0]
        require((case["id"], case["dpr"]) == (body, dpr), f"Wrong body/DPR: {label}")
        require(case.get("status") == "CAPTURED_UNREVIEWED", f"Incomplete case: {label}")
        require(case["errors"] == [] and case["contextClose"] == "COMPLETE", f"Runtime/close error: {label}")
        require({v["lensId"] for v in case["views"]} == lenses, f"Wrong lens set: {label}")
        require(len(case["views"]) == len(lenses) * 2, f"Missing lighting state: {label}")
        for record in report["frozenFiles"] + report["sharedFiles"] + [report["script"]]:
            add_capture_pin(record)
        for style in report["styleArtifacts"]:
            artifact(style, True, label)
        for item in case["loadedResponses"]:
            require(item["status"] == 200 and (item.get("matchesLocal") is True or
                    item.get("matchesPreparedObject") is True), f"Loaded bytes not pinned: {label}/{item['url']}")
            if item.get("localPath"):
                add_capture_pin({"path": item["localPath"], "bytes": item["bytes"], "sha256": item["sha256"]})
            elif item.get("matchesPreparedObject"):
                add_capture_pin({"path": f"src/planets/{body}/prepared/object.json",
                                 "bytes": item["bytes"], "sha256": item["sha256"]})
        require(any(x.get("matchesPreparedObject") for x in case["loadedResponses"]),
                f"No exact prepared object response: {label}")
        for view in case["views"]:
            lens, shadows = view["lensId"], view["shadows"]
            require(view.get("status") == "CAPTURED_UNREVIEWED", f"Incomplete view: {label}/{lens}")
            require(type(shadows) is bool, f"Invalid lighting flag: {label}")
            key = (body, dpr, lens, shadows)
            require(key not in cases, f"Duplicate case: {key}")
            cases.add(key)
            leaves = check_snapshot(view["beforeDrag"], body, lens, shadows)
            require(all(block["visible"] for block in view["visibleDescriptionAndLegend"]["blocks"]),
                    f"Description/legend was hidden: {key}")
            if shadows:
                drag = view["drag"]
                require(all(drag[k] is True for k in ("allNodesRetained", "ownerSame", "stable")) and
                        drag["nodeCount"] == drag["nodeCountAfter"], f"Retained drag failed: {key}")
                require(check_snapshot(view["afterDrag"], body, lens, shadows) == leaves,
                        f"Leaf count changed: {key}")
            require(any(x["path"].endswith("-scene.png") for x in view["screenshots"]),
                    f"Missing scene image: {key}")
            for image in view["screenshots"]:
                name = Path(image["path"]).name
                keep = ((dpr == 1 and name.endswith("-scene.png")) or
                        (dpr == 1 and lens != "normal" and not shadows and "-details-" in name) or
                        (dpr == 2 and lens == "ice-absorption" and not shadows and name.endswith("-scene.png")))
                artifact(image, keep, f"{body}-dpr{dpr}")
            index["cases"].append({"body": body, "dpr": dpr, "lens": lens, "shadows": shadows,
                                   "reportLabel": label, "retainedLeaves": leaves,
                                   "retainedDragChecked": shadows,
                                   "visibleDescription": view["visibleDescriptionAndLegend"]["text"]})
        for card in case["cardNavigation"]:
            for image in card["screenshots"]:
                artifact(image, False, label)
        target = destination / "browser" / f"{label}.json"
        report_pin = copy_pinned(report_path, target)
        for source in (receipt_path, log_path):
            copy_pinned(source, destination / "checks" / source.name)
        index["reports"].append({"label": label, "body": body, "dpr": dpr,
                                 "path": target.relative_to(destination).as_posix(), **report_pin,
                                 "originalPath": relative(report_path), "head": report["head"],
                                 "startedAt": report["startedAt"], "finishedAt": report["finishedAt"],
                                 "viewLightingCases": len(case["views"]), "runtimeErrors": 0,
                                 "browserClose": "COMPLETE", "contextClose": "COMPLETE",
                                 "resourceReceipt": {"path": f"checks/{receipt_path.name}", **pin(receipt_path)},
                                 "captureLog": {"path": f"checks/{log_path.name}", **pin(log_path)},
                                 "settingsAccess": report.get("settingsAccess"),
                                 "peakRSSBytes": receipt["peakRSSBytes"], "seconds": receipt["seconds"]})

    expected_cases = set(itertools.product(BODIES, (1, 2), LENSES, (False, True)))
    require(cases == expected_cases, f"Incomplete 36-case coverage: missing={expected_cases - cases}")
    for body in BODIES:
        require(len({x["retainedLeaves"] for x in index["cases"] if x["body"] == body}) == 1,
                f"Retained leaf count differs across lenses/DPR: {body}")
    heads = {run[4][4]["head"] for run in runs}
    require(len(heads) == 1, f"Mixed tested base commits: {heads}")
    mismatch = []
    for name, expected in sorted(captured_pins.items()):
        actual = current_pin(ROOT / name)
        if actual != expected:
            mismatch.append({"path": name, "captured": expected, "current": actual})
    source_check = {"schema": "cssearth-b9-collected-source-check@1",
                    "captureHead": next(iter(heads)), "capturePins": len(captured_pins),
                    "currentCapturePinMismatches": mismatch, "bodies": []}
    for body in BODIES:
        source_root = ROOT / f"src/planets/{body}/source"
        manifest_path = source_root / "manifest.json"
        manifest = read_json(manifest_path)
        entries = {}
        for entry in manifest.get("inputs", []) + manifest.get("documents", []):
            if entry.get("path", "").startswith("cassini-ice/"):
                entries[entry["path"]] = entry
        require(entries, f"Missing final source manifest entries: {body}")
        verified = []
        for name, entry in sorted(entries.items()):
            expected = {"bytes": entry["expectedBytes"], "sha256": entry["expectedSha256"]}
            require(current_pin(source_root / name) == expected, f"Source manifest mismatch: {body}/{name}")
            verified.append({"path": relative(source_root / name), **expected})
        tiffs = [x for x in verified if x["path"].endswith(".tif")]
        require(len(tiffs) == 7, f"Expected seven scientific/output TIFFs: {body}")
        source_check["bodies"].append({"body": body, "manifest": {"path": relative(manifest_path), **pin(manifest_path)},
                                      "verifiedEntries": verified, "tiffCount": len(tiffs),
                                      "verifiedBytes": sum(x["bytes"] for x in verified)})

    packages_path = ROOT / "output/b9-qualification/packages.json"
    packages = read_json(packages_path)
    require(packages["status"] in ("PASS", "SELECTED_PACKAGES_PASS_SHARED_AUDIT_BLOCKED_ON_BASELINE"),
            "Selected package closure did not pass")
    require({x["id"] for x in packages["objects"]} == set(BODIES), "Package closure cohort mismatch")
    for body in packages["objects"]:
        name = f"src/planets/{body['id']}/prepared/scene.json"
        require(body["retainedTreeUnchanged"] is True and captured_pins[name]["sha256"] == body["sceneSha256"],
                f"Package/capture retained geometry mismatch: {body['id']}")
    package_base_matches = packages["base"] in heads
    require(args.historical or (not mismatch and package_base_matches),
            "Capture no longer matches this checkout or package-check base; recapture, or collect explicitly as --historical")
    source_check["qualification"] = "CURRENT_CAPTURE_PINS_MATCH" if not mismatch else "HISTORICAL_CAPTURE_CURRENT_FILES_DIFFER"
    source_check["packageBaseMatchesCapture"] = package_base_matches
    source_check["retainedGeometry"] = packages["objects"]
    source_check["sharedOwnershipAuditStatus"] = packages["status"]
    copy_pinned(packages_path, destination / "packages.json")
    write_json(destination / "source-checks.json", source_check)

    checks = [safe_path(p) for p in args.check]
    for label in ["b9-final-sources", "b9-final-phoebe-source", "b9-package-closure",
                  *[f"b9-prepare-{b}" for b in BODIES],
                  *[f"{args.prefix}-build-{part}" for part in ("packages", "renderer", "preparation")],
                  *[f"{args.prefix}-finalize-{b}-restored" for b in BODIES]]:
        path = ROOT / "output/b3-resume" / f"{label}.json"
        if path.exists():
            checks.append(path)
    if args.source_reproduction:
        checks.append(safe_path(args.source_reproduction))
    index["sourceReproduction"] = "NOT_COLLECTED"
    for source in dict.fromkeys(checks):
        data = read_json(source)
        name = "source-reproduction.json" if args.source_reproduction and source == safe_path(args.source_reproduction) else source.name
        if name == "source-reproduction.json":
            require(data.get("status") == "PASS" and data.get("matchedTiffs") == 21 and
                    data.get("originalPackagesUnchanged") is True and data.get("seededGeneratedFiles") == [],
                    "Source reproduction did not pass an empty-output 21-TIFF replay")
            require({x["body"] for x in data["bodies"]} == set(BODIES), "Reproduction cohort differs")
            for reproduced in data["bodies"]:
                body = reproduced["body"]
                source_root = ROOT / f"src/planets/{body}/source"
                require(reproduced["status"] == "PASS" and len(reproduced["products"]) == 7 and
                        reproduced["sourceManifestSha256"] == current_pin(source_root / "manifest.json")["sha256"],
                        f"Reproduction manifest no longer matches: {body}")
                for product in reproduced["products"]:
                    actual = current_pin(source_root / "cassini-ice" / product["file"])
                    require(product["exactBytes"] is True and actual == {k: product[k] for k in ("bytes", "sha256")},
                            f"Reproduced output differs from current source: {body}/{product['file']}")
            for path, expected in data["toolPins"].items():
                require(current_pin(safe_path(path))["sha256"] == expected, f"Reproduction helper changed: {path}")
            index["sourceReproduction"] = "PASS_21_EXACT_TIFFS_CURRENT_PINS"
        target = destination / "checks" / name
        receipt_pin = copy_pinned(source, target)
        index["checks"].append({"originalPath": relative(source), "path": target.relative_to(destination).as_posix(),
                                **receipt_pin, "status": data.get("status"),
                                "qualification": "Original receipt; its own scope and base still apply."})
    index.update({"captureHead": next(iter(heads)), "viewLightingCases": len(cases),
                  "captureIntegrity": "PASS", "currentCheckoutQualification": source_check["qualification"],
                  "currentCapturePinMismatches": len(mismatch), "packageBaseMatchesCapture": package_base_matches,
                  "retainedGeometryClosure": "PASS", "packageCheckStatus": packages["status"],
                  "artifacts": list(artifacts.values()), "uniqueRetainedArtifacts": len(retained),
                  "retainedArtifactBytes": sum(next(x["bytes"] for x in artifacts.values()
                                              if x["sha256"] == key[0]) for key in retained),
                  "screenshotPolicy": "All DPR1 scenes, unlit DPR1 scientific descriptions/legends, and unlit DPR2 ice scenes; all captures hashed, identical bytes deduplicated."})
    if any((x.get("settingsAccess") or {}).get("publicButtonVisible") is False for x in index["reports"]):
        index["limits"].append("Settings access used the existing hidden input binding; public button reachability is not proven.")
    write_json(destination / "browser-index.json", index)
    (destination / "README.md").write_text(
        "# B9 collected evidence\n\n"
        f"Capture prefix: `{args.prefix}`. Tested integration base: `{index['captureHead']}`.\n\n"
        f"The [browser index](browser-index.json) accounts for all {len(cases)} unique body/DPR/lens/lighting cases "
        f"in {len(runs)} completed reports. Reports are copied without rewriting any bytes. "
        "Their original absolute machine paths and `CAPTURED_UNREVIEWED` status remain intact; "
        "the index maps retained artifacts to portable evidence paths. Human visual acceptance is separate.\n\n"
        f"Current checkout comparison: `{index['currentCheckoutQualification']}`. "
        "[Source checks](source-checks.json) record the exact captured-file comparison and verify the "
        "packaged Cassini inputs, numerical outputs and support/ownership TIFFs against source manifests. "
        f"Source replay: `{index['sourceReproduction']}`.\n\n"
        "[Package closure](packages.json) retains its original status and scope, including any shared "
        "audit limitation. Its retained scene hashes must match the captures; browser snapshots and "
        "drag checks require stable ownership and leaf counts across all selected views.\n\n"
        "All screenshot bytes are checked against the original reports, including images not duplicated here. "
        "The compact checked-in selection includes every DPR1 scene, unlit DPR1 scientific detail/legend "
        "screenshots, and one unlit DPR2 ice scene per body. Identical screenshots and styles are deduplicated. "
        "Every captured stylesheet is retained. Bounded resource receipts and capture logs are under `checks/`.\n\n"
        "This evidence does not establish compositor frame rate, native renderer parity, exact absolute "
        "scientific registration, or general platform readiness. Failed combined browser runs are excluded; "
        "successful split runs provide the corresponding cases.\n"
    )
    print(json.dumps({"status": index["currentCheckoutQualification"], "reports": len(runs),
                      "viewLightingCases": len(cases), "retainedArtifacts": len(retained),
                      "retainedArtifactBytes": index["retainedArtifactBytes"],
                      "index": relative(destination / "browser-index.json")}))


if __name__ == "__main__":
    main()
