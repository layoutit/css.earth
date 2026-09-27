"""Collect NASA Solar System Treks map products into the ledger.

    python tools/sources/astronomy-data/cleanup/collect_trek.py tools/sources/astronomy-data/ledger.sqlite [--dry-run]

Each Trek portal lists its layers through TrekServices searchItems. A product with a category (Imagery, Topography,
Gravity, ...) is a map layer: one `datasets` row, source `trek`, with the full record in details_json. Items without a
category are single observations (Titan's VIMS cubes and ISS frames): they are counted per portal and instrument in one
`inventory` row each, source `trek-observations`, like OPUS slices. Requests run one at a time.
"""
import datetime, json, os, sys, time, urllib.request
import sqlite_utils

PORTALS = {  # Trek portal -> the body its layers show
    "moon": "Moon", "mars": "Mars", "mercury": "Mercury", "venus": "Venus", "vesta": "Vesta", "ceres": "Ceres",
    "titan": "Titan", "europa": "Europa", "ganymede": "Ganymede", "io": "Io", "enceladus": "Enceladus",
    "phobos": "Phobos", "ryugu": "Ryugu",
}
ROWS = 500
db = sqlite_utils.Database(sys.argv[1])
dry = "--dry-run" in sys.argv
now = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

CACHE = os.environ.get("TREK_CACHE")  # a folder of saved pages, so a rerun does not fetch them again

def page(portal, start):
    path = CACHE and os.path.join(CACHE, f"{portal}-{start}.json")
    if path and os.path.exists(path):
        return json.load(open(path))["response"]
    url = f"https://trek.nasa.gov/{portal}/TrekServices/ws/index/eq/searchItems?start={start}&rows={ROWS}&key=*"
    for attempt in range(3):
        t = time.time()
        try:
            with urllib.request.urlopen(url, timeout=45) as r:
                body = r.read()
            print(f"  {portal} start={start}: {len(body):,} bytes in {time.time() - t:.1f}s", flush=True)
            if path:
                os.makedirs(CACHE, exist_ok=True)
                open(path, "wb").write(body)
            return json.loads(body)["response"]
        except Exception as e:  # a slow page is retried, then reported
            print(f"  {portal} start={start}: attempt {attempt + 1} failed after {time.time() - t:.1f}s ({e})", flush=True)
            if attempt == 2:
                raise RuntimeError(f"Trek {portal} start={start}: {e}")
            time.sleep(3)

def size(doc):
    fs = doc.get("fileSize")
    fs = fs[0] if isinstance(fs, list) and fs else fs
    return fs if isinstance(fs, (int, float)) and fs > 0 else None

products, observations = [], {}
for portal, body in PORTALS.items():
    start, seen, found = 0, 0, 0
    # Titan lists 130,000 single observations after its maps: stop paging once three pages in a row hold no map.
    empty_pages = 0
    while True:
        resp = page(portal, start)
        docs = resp["docs"]
        if not docs:
            break
        maps_here = 0
        for doc in docs:
            if doc.get("itemType") != "product":
                continue
            seen += 1
            # A map layer has a category, or is global, or is served as a mosaic (Titan's and Ceres's maps carry no category).
            if doc.get("productCat1") or doc.get("coverage") == "Global" or "Mosaic" in (doc.get("serviceTypes") or []):
                maps_here += 1
                products.append((portal, body, doc))
            else:
                key = (portal, doc.get("instrument") or "unstated")
                observations[key] = observations.get(key, 0) + 1
        found += maps_here
        start += ROWS
        empty_pages = 0 if maps_here else empty_pages + 1
        if start >= resp["numFound"] or (portal == "titan" and empty_pages >= 3):
            break
        time.sleep(0.5)
    print(f"{portal}: {found} map products, {seen - found} observations read", flush=True)

# Titan: the facet totals give every observation, not just the pages read.
with urllib.request.urlopen("https://trek.nasa.gov/titan/TrekServices/ws/index/eq/searchItems?start=0&rows=0&key=*", timeout=120) as r:
    facet = json.load(r).get("facet_counts", {}).get("facet_fields", {}).get("instrument", [])
titan_maps = {}
for portal, body, doc in products:
    if portal == "titan":
        titan_maps[doc.get("instrument") or "unstated"] = titan_maps.get(doc.get("instrument") or "unstated", 0) + 1
for name, n in zip(facet[0::2], facet[1::2]):
    observations[("titan", name)] = n - titan_maps.get(name, 0)

def row(portal, body, doc):
    flat = lambda v: ", ".join(map(str, v)) if isinstance(v, list) else v
    cat = " / ".join(flat(c) for c in (doc.get("productCat1"), doc.get("productCat2"), doc.get("productCat3")) if c) or "map layer"
    res = doc.get("resolution")
    extent = flat(doc.get("coverage")) or ("bbox " + doc["bbox"] if doc.get("bbox") else "extent unstated")
    parts = [f"Trek {portal} {cat}", extent.lower() if extent in ("Global", "Regional") else extent]
    if res:
        parts.append(f"{res} degrees per pixel")
    raster = doc.get("RASTER_TYPE")
    if raster:
        parts.append(", ".join(raster) if isinstance(raster, list) else str(raster))
    if size(doc):
        parts.append(f"{size(doc):,} bytes")
    label = doc["productLabel"]
    folder = body.replace(" ", "")
    return {
        "source": "trek", "id": f"{portal}/{label}", "title": flat(doc.get("title")) or label, "target": body,
        "instrument": flat(doc.get("instrument")) or "", "record_count": 1,
        "decision": "global-layer" if doc.get("coverage") == "Global" else "regional-layer",
        "reason": ", ".join(parts) + ".",
        "url": f"https://trek.nasa.gov/tiles/{folder}/EQ/{label}/1.0.0/WMTSCapabilities.xml",
        "details_json": json.dumps({**doc, "portal": portal, "retrievedAt": now}, ensure_ascii=False),
        "family": f"{portal}/{label}",
    }

rows = {}
for portal, body, doc in products:
    r = row(portal, body, doc)
    rows[r["id"]] = r  # a label listed twice keeps one row
inv = [{
    "source": "trek-observations", "id": f"{portal}/{inst}", "title": f"{PORTALS[portal]} {inst} single observations on Trek",
    "target": PORTALS[portal], "instrument": inst, "record_count": n, "decision": "observation-inventory",
    "reason": f"Trek {portal} lists {n:,} single {inst} observations (image cubes or frames), not map layers; counted, not listed.",
    "url": f"https://trek.nasa.gov/{portal}/", "details_json": json.dumps({"portal": portal, "retrievedAt": now}),
} for (portal, inst), n in sorted(observations.items()) if n > 0]
print(json.dumps({"map_products": len(rows), "global": sum(r["decision"] == "global-layer" for r in rows.values()),
                  "observation_rows": len(inv), "observations": sum(r["record_count"] for r in inv)}, indent=1))
if dry:
    sys.exit(0)
with db.conn:
    db.execute("DELETE FROM dataset_bodies WHERE source='trek'") if db["dataset_bodies"].exists() else None
    db.execute("DELETE FROM dataset_instruments WHERE source='trek'") if db["dataset_instruments"].exists() else None
    db.execute("DELETE FROM datasets WHERE source='trek'")
    db.execute("DELETE FROM inventory WHERE source='trek-observations'")
    db["datasets"].insert_all(rows.values())
    db["inventory"].insert_all(inv)
    db["ledger_log"].delete_where("operation = ?", ["trek"])
    db["ledger_log"].insert({"at": now[:10], "operation": "trek", "detail":
        "NASA Solar System Treks: every portal's searchItems listing. Products with a category are map layers (datasets, source trek, "
        "decision global-layer or regional-layer, reason from the record's category, extent, resolution, raster type and size). "
        "Uncategorised items are single observations, counted per portal and instrument in inventory (trek-observations)."})
print("written")
