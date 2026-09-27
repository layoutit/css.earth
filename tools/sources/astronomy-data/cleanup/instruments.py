"""Build missions, instruments and dataset_instruments in the ledger from each archive's own instrument fields."""
import json, re, sys, datetime, collections
import sqlite_utils

db = sqlite_utils.Database(sys.argv[1])
dry = "--dry-run" in sys.argv

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# ---------- missions
missions = {}  # id -> {name, aliases:set, kind}
ALIAS = {  # the same mission under another archive's name
    "voyager-program": "voyager", "voyager-1": "voyager", "voyager-2": "voyager", "vg2": "voyager",
    "hubble-space-telescope": "hubble", "hst": "hubble", "new-horizons": "new-horizons",
    "near-shoemaker": "near", "cassini-huygens": "cassini", "galileo-orbiter": "galileo", "go": "galileo",
    "mars-reconnaissance-orbiter": "mro", "lunar-reconnaissance-orbiter": "lro", "mars-global-surveyor": "mgs",
    "mars-exploration-rover": "mer", "mars-science-laboratory": "msl", "stardust": "stardust", "sdu": "stardust",
    "huygens": "cassini", "epoxi": "deep-impact", "deep-impact-epoxi": "deep-impact",  # Huygens is Cassini's probe; EPOXI is Deep Impact's extended mission
}
mid_of = lambda name: ALIAS.get(slug(name), slug(name))
def mission(name, kind="spacecraft", aliases=()):
    mid = ALIAS.get(slug(name), slug(name))
    m = missions.setdefault(mid, {"name": name, "aliases": set(), "kind": kind})
    for a in aliases:
        if a and a != m["name"]:
            m["aliases"].add(a)
    return mid

# Maryland PDS3 dataset ids start with the spacecraft or observatory code.
UMD_MISSION = {
    "ro": "Rosetta", "rl": "Rosetta", "ro_rl": "Rosetta", "dif": "Deep Impact", "dii": "Deep Impact", "di": "Deep Impact",
    "di_ear": "Earth-based observatories", "di_iras": "IRAS", "gio": "Giotto", "sdu": "Stardust", "stardust": "Stardust",
    "vega1": "Vega 1", "vega2": "Vega 2", "ihw": "International Halley Watch", "ice": "International Cometary Explorer",
    "go": "Galileo", "ds1": "Deep Space 1", "con": "CONTOUR", "phb2": "Phobos 2", "soho": "SOHO", "sakig": "Sakigake",
    "suisei": "Suisei", "vg2": "Voyager", "hst": "Hubble", "irtf": "IRTF", "eso": "European Southern Observatory",
    "oao": "Okayama Astrophysical Observatory", "mssso": "Mount Stromlo and Siding Spring Observatories",
    "iue": "International Ultraviolet Explorer", "ear": "Earth-based observatories", "msx": "MSX", "brrison": "BRRISON",
    "nh": "New Horizons",
}
# Maryland PDS4 bundles name their mission first in the bundle id ("pds4-lucy.leisa", "pds4-epoxi_mri").
PDS4_MISSION = {"epoxi": "Deep Impact", "nh": "New Horizons", "lucy": "Lucy", "dart": "DART", "ro": "Rosetta"}
OBSERVATORIES = {"Earth-based observatories", "European Southern Observatory", "Okayama Astrophysical Observatory",
                 "Mount Stromlo and Siding Spring Observatories", "IRTF", "International Halley Watch"}
# Instrument codes Maryland's Rosetta, New Horizons and Deep Impact rows use.
CODES = {
    "RSI": "Radio Science Investigation", "OSINAC": "OSIRIS Narrow Angle Camera", "OSIWAC": "OSIRIS Wide Angle Camera",
    "OSIRIS": "OSIRIS", "NAVCAM": "Navigation Camera", "RPCICA": "RPC Ion Composition Analyser", "ROMAP": "ROMAP",
    "VIRTIS": "VIRTIS", "ALICE": "Alice ultraviolet spectrometer", "RPCMAG": "RPC Magnetometer", "RPCLAP": "RPC Langmuir Probe",
    "CONSERT": "CONSERT", "MIRO": "MIRO", "ROSINA": "ROSINA", "MIDAS": "MIDAS", "RPCIES": "RPC Ion and Electron Sensor",
    "RPCMIP": "RPC Mutual Impedance Probe", "LORRI": "Long Range Reconnaissance Imager",
    "MVIC": "Multispectral Visible Imaging Camera", "LEISA": "Linear Etalon Imaging Spectral Array", "MRI": "Medium Resolution Instrument",
    "HRIV": "High Resolution Instrument visible CCD", "REX": "Radio Science Experiment", "HRII": "High Resolution Instrument infrared spectrometer",
    "GIADA": "GIADA", "PTOLEMY": "Ptolemy", "SESAME": "SESAME", "MUPUS": "MUPUS", "COSAC": "COSAC", "ITS": "Impactor Targeting Sensor",
    "COSIMA": "COSIMA",
}
OPUS_SPACECRAFT = ["New Horizons", "Cassini", "Voyager", "Galileo", "Hubble"]

links = []  # (source, id, instrument key, name_in_source)
instruments = {}  # key -> {mission, name, acronym}
def instrument(mid, name, acronym, raw, source, did):
    key = f"{mid}/{slug(acronym or name)}"
    known = instruments.setdefault(key, {"mission_id": mid, "name": name, "acronym": acronym})
    # Keep the fullest name an archive gives ("Long range reconnaissance imager" over "LORRI").
    if len(name) > len(known["name"]) and known["name"].upper() == (known["acronym"] or "").upper():
        known["name"] = name
    links.append((source, did, key, raw))

def keywords(details, kind):
    kws = (details.get("metadata") or {}).get("keywords") or []
    return [k.split(":", 1)[1] for k in kws if isinstance(k, str) and k.startswith(kind + ":")]

def parts(raw):
    return [p.strip() for p in raw.split(";") if p.strip()]

def acronym_of(name):
    found = re.findall(r"\(([^()]+)\)", name)
    return "/".join(found)

rows = list(db.query("SELECT source, id, title, instrument, details_json FROM datasets"))
# Photojournal: learn each instrument's mission from rows that name one mission.
pj_single = collections.defaultdict(collections.Counter)
for r in rows:
    if r["source"] != "photojournal":
        continue
    d = json.loads(r["details_json"]); ms = sorted({mid_of(m) for m in parts(d.get("mission") or "")})
    if len(ms) == 1:
        for i in parts(r["instrument"]):
            pj_single[i][ms[0]] += 1

STOP = {"and", "of", "for", "the", "a", "on", "to"}
# Photojournal mission slugs that are abbreviations; the rest are names ("dawn" is Dawn, "mro" is MRO).
ACRONYM_MISSIONS = {"mro", "mgs", "lro", "msl", "mer", "srtm", "eos", "near", "aria", "smap", "emit", "ostm", "cowvr", "grfm",
                    "bice", "bsgc", "dspse", "modis", "uavsar", "airsar", "glims", "messenger", "spherex", "neowise", "ecostress",
                    "grace", "gpm", "iss"}
from functools import lru_cache
def spells(acronym, name):
    """True when the acronym reads through the name: its first letter starts the first word, and each later letter
    either continues the current word or starts the next one, leaving at most one word unstarted ("HiRISE" in "high
    resolution imaging science experiment", "CTX" in "context camera", "CIRS" in "composite infrared spectrometer")."""
    a = re.sub(r"[^a-z0-9]", "", acronym.lower())
    words = [w for w in re.findall(r"[a-z0-9]+", name.lower()) if w not in STOP]
    if not a or not words or a[0] != words[0][0]:
        return False
    if len(words) == 1:
        return len(a) >= 3 and words[0].startswith(a)
    @lru_cache(None)
    def go(ai, wi, ci, started):
        if ai == len(a):
            return started >= len(words) - 1
        ch = a[ai]
        for nxt in (wi + 1, wi + 2):  # the next word, or the one after it (SHARAD skips "subsurface")
            if nxt < len(words) and words[nxt][0] == ch and go(ai + 1, nxt, 0, started + 1):
                return True
        j = words[wi].find(ch, ci + 1)
        return j >= 0 and go(ai + 1, wi, j, started)
    return go(1, 0, 0, 1)
# Photojournal files the LRO and MESSENGER wide-angle cameras as "wac-narrow-angle-camera".
PJ_FIX = {"wac-narrow-angle-camera": ("Wide angle camera", "WAC")}
def pj_instrument(s):
    if s in PJ_FIX:
        return PJ_FIX[s]
    words = s.split("-")
    if len(words) >= 2 and spells(words[0], " ".join(words[1:])):
        return " ".join(words[1:]).capitalize(), words[0].upper()
    if len(words) >= 3 and spells(words[-1], " ".join(words[:-1])):
        return " ".join(words[:-1]).capitalize(), words[-1].upper()
    return " ".join(words).capitalize(), ""

unresolved = collections.Counter()
for r in rows:
    src, did, raw = r["source"], r["id"], r["instrument"]
    d = json.loads(r["details_json"])
    if src == "opus":
        sc = next((p for p in OPUS_SPACECRAFT if raw.startswith(p + " ")), None)
        if sc:
            mid = mission(sc)
            instrument(mid, raw[len(sc) + 1:], raw[len(sc) + 1:], raw, src, did)
        else:  # a ground or airborne telescope is its own facility
            mid = mission(raw, "observatory")
            instrument(mid, raw, "", raw, src, did)
    elif src == "darts":
        names = keywords(d, "mission")
        if not names:
            unresolved["darts: no mission keyword"] += 1
            continue
        mid = mission(names[0].title() if names[0].isupper() and len(names[0]) > 5 else names[0], aliases=names[1:])
        for i in keywords(d, "instrument") or parts(raw):
            instrument(mid, re.sub(r"\s*\([^()]+\)", "", i).strip() or i, acronym_of(i), i, src, did)
    elif src == "umd":
        code = did.split("/")[0].lower()
        prefix = next((p for p in sorted(UMD_MISSION, key=len, reverse=True) if code.startswith(p + "-") or code.startswith(p + "_")), None)
        if not raw:
            continue
        bundle = re.match(r"pds4-([a-z0-9]+)", code)
        if prefix is None and bundle:
            name = PDS4_MISSION.get(bundle.group(1), bundle.group(1).upper())
        elif prefix is None and (r["title"] or "").startswith("New Horizons"):
            name = "New Horizons"
        elif prefix is None:
            unresolved["umd: no mission code"] += 1
            continue
        else:
            name = UMD_MISSION[prefix]
        mid = mission(name, "observatory" if name in OBSERVATORIES else "spacecraft")
        codes = parts(raw)
        # "OSINAC; OSIRIS" is the NAC of the OSIRIS suite: keep the specific camera.
        if len(codes) > 1 and "OSIRIS" in codes:
            codes = [c for c in codes if c != "OSIRIS"]
        for c in codes:
            instrument(mid, CODES.get(c, c), c, raw, src, did)
    elif src == "photojournal":
        ms = sorted({mid_of(m) for m in parts(d.get("mission") or "")})
        for i in parts(raw):
            if len(ms) == 1:
                m = ms[0]
            else:
                # The mission this instrument flies on in single-mission rows, among the missions this row names.
                seen = [(n, x) for x, n in (pj_single.get(i) or {}).items() if x in ms]
                m = max(seen)[1] if seen else None
            if not m:
                unresolved["photojournal: several missions, instrument never seen with one"] += 1
                continue
            name, acr = pj_instrument(i)
            mname = " ".join(w.upper() if w in ACRONYM_MISSIONS else w.capitalize() for w in m.split("-"))
            instrument(mission(mname), name, acr, i, src, did)

# One instrument, two archives: "Cassini ISS" (OPUS) and "imaging-science-subsystem" (Photojournal). Within a mission, a
# name without an acronym that another instrument's acronym spells is that instrument.
merged = {}
by_mission = collections.defaultdict(dict)
for k, v in instruments.items():
    if v["acronym"]:
        by_mission[v["mission_id"]][re.sub(r"[^a-z0-9]", "", v["acronym"].lower())] = k
for k, v in list(instruments.items()):
    if v["acronym"]:
        continue
    target = next((t for a, t in by_mission[v["mission_id"]].items() if spells(a, v["name"])), None)
    if target and target != k:
        merged[k] = target
        instruments[target]["name"] = instruments[target]["name"] if instruments[target]["name"] != instruments[target]["acronym"] else v["name"]
        del instruments[k]
links = [(s_, i, merged.get(k, k), raw) for s_, i, k, raw in links]
print(json.dumps({"missions": len(missions), "instruments": len(instruments), "links": len(links),
                  "datasets_linked": len({(s, i) for s, i, _, _ in links}), "merged": len(merged), "unresolved": unresolved}, indent=1))
if dry:
    sys.exit(0)

with db.conn:
    for t in ["dataset_instruments", "instruments", "missions"]:
        db[t].drop(ignore=True)
    db["missions"].insert_all(
        [{"id": k, "name": v["name"], "kind": v["kind"], "aliases": json.dumps(sorted(v["aliases"]))} for k, v in missions.items()],
        pk="id")
    db["instruments"].insert_all([{"id": k, **v} for k, v in instruments.items()], pk="id", foreign_keys=[("mission_id", "missions", "id")])
    db.execute("""CREATE TABLE dataset_instruments (source TEXT NOT NULL, dataset_id TEXT NOT NULL,
        instrument_id TEXT NOT NULL REFERENCES instruments(id), name_in_source TEXT NOT NULL,
        PRIMARY KEY (source, dataset_id, instrument_id), FOREIGN KEY (source, dataset_id) REFERENCES datasets(source, id))""")
    seen = set()
    db["dataset_instruments"].insert_all(
        [{"source": s, "dataset_id": i, "instrument_id": k, "name_in_source": raw}
         for s, i, k, raw in links if (s, i, k) not in seen and not seen.add((s, i, k))],
        )
    db["dataset_instruments"].create_index(["instrument_id"])
    db["ledger_log"].delete_where("operation = ?", ["instruments"]) if db["ledger_log"].exists() else None
    db["ledger_log"].insert({
        "at": datetime.date.today().isoformat(), "operation": "instruments",
        "detail": "missions, instruments and dataset_instruments rebuilt from each archive's instrument field: OPUS 'Mission INSTR' "
                  "or a telescope; DARTS mission:/instrument: keywords (first mission name, the rest aliases); Maryland PDS3 id "
                  "prefix for the mission and its instrument codes; Photojournal mission and instrument slugs, a several-mission "
                  "row taking the mission the instrument has in single-mission rows. USGS and PSI PDS4 state no instrument.",
    })
print("written")
