// Entry script: node packages/bake/cli/astronomy-data-collect-opus-products.mts. OPUS pipeline stage: named product
// records the review rules cite (rings, spectra, occultations, encounters), into OPUS_WORK_DIR; the shared client is
// in @cssearth/bake/sources/astronomy-data.
import { writeFile } from "node:fs/promises";
import { get, batch, object, array, string, workDir } from "@cssearth/bake/sources/astronomy-data";
const choices: [string, Record<string, string>][] = [
  ["saturn-opacity", { instrument: "Cassini RSS", target: "Saturn Rings" }],
  ["uranus-opacity", { instrument: "Voyager PPS", target: "Uranus Rings" }],
  [
    "uranus-ground",
    { instrument: "Cerro Tololo Victor Blanco 4m", target: "Uranus Rings" },
  ],
  ["uranus-atmosphere", { instrument: "Hubble FOS", target: "Uranus" }],
  ["neptune-opacity", { instrument: "Voyager PPS", target: "Neptune Rings" }],
  ["neptune-arcs", { instrument: "Voyager ISS", target: "Neptune Rings" }],
  ["mimas-thermal", { instrument: "Cassini CIRS", target: "Mimas" }],
  [
    "dione-infrared",
    {
      instrument: "Cassini VIMS",
      target: "Dione",
      surfacegeometrytargetname: "Dione",
      SURFACEGEOdione_centerresolution1: "0.000001",
      order: "SURFACEGEOdione_centerresolution1,opusid",
    },
  ],
  [
    "mimas-infrared",
    {
      instrument: "Cassini VIMS",
      target: "Mimas",
      surfacegeometrytargetname: "Mimas",
      SURFACEGEOmimas_centerresolution1: "0.000001",
      order: "SURFACEGEOmimas_centerresolution1,opusid",
    },
  ],
  [
    "hyperion-infrared",
    {
      instrument: "Cassini VIMS",
      target: "Hyperion",
      surfacegeometrytargetname: "Hyperion",
      SURFACEGEOhyperion_centerresolution1: "0.000001",
      order: "SURFACEGEOhyperion_centerresolution1,opusid",
    },
  ],
  [
    "dione-ultraviolet",
    { instrument: "Cassini UVIS", target: "Dione", COUVISchannel: "FUV" },
  ],
  [
    "europa-ultraviolet",
    {
      instrument: "Hubble STIS",
      target: "Europa",
      observationtype: "Spectrum",
    },
  ],
  [
    "uranus-voyager",
    {
      instrument: "Voyager ISS",
      target: "Uranus",
      surfacegeometrytargetname: "Uranus",
      SURFACEGEOuranus_centerresolution1: "0.000001",
      order: "SURFACEGEOuranus_centerresolution1,opusid",
    },
  ],
  [
    "miranda-bands",
    {
      instrument: "Voyager ISS",
      target: "Miranda",
      surfacegeometrytargetname: "Miranda",
      SURFACEGEOmiranda_centerresolution1: "0.000001",
      order: "SURFACEGEOmiranda_centerresolution1,opusid",
    },
  ],
  [
    "proteus-bands",
    {
      instrument: "Voyager ISS",
      target: "Proteus",
      surfacegeometrytargetname: "Proteus",
      SURFACEGEOproteus_centerresolution1: "0.000001",
      order: "SURFACEGEOproteus_centerresolution1,opusid",
    },
  ],
  [
    "pluto-bands",
    {
      instrument: "New Horizons MVIC",
      target: "Pluto",
      time1: "2015-07-14",
      time2: "2015-07-15",
    },
  ],
  ["charon-bands", { instrument: "New Horizons MVIC", target: "Charon" }],
  ["nix-bands", { instrument: "New Horizons MVIC", target: "Nix" }],
  [
    "arrokoth-imaging",
    {
      instrument: "New Horizons LORRI",
      target: "Arrokoth",
      time1: "2019-01-01",
      time2: "2019-01-02",
    },
  ],
  ["venus-clouds", { instrument: "Galileo SSI", target: "Venus" }],
  [
    "giant-spectra",
    {
      instrument: "Hubble STIS",
      target: "Uranus",
      observationtype: "Spectrum",
    },
  ],
  [
    "enceladus-occultation",
    {
      instrument: "Cassini UVIS",
      surfacegeometrytargetname: "Enceladus",
      COUVISchannel: "HSP",
    },
  ],
  [
    "chariklo-photometry",
    { instrument: "Hubble WFC3", target: "Chariklo Ring" },
  ],
];
const cols = [
  "opusid",
  "target",
  "time1",
  "time2",
  "bundleid",
  "datasetid",
  "primaryfilespec",
  "quantity",
  "observationtype",
];
const results: unknown[] = [];
await batch(
  choices,
  async ([id, q]) => {
    const query = { ...q, cols: cols.join(","), limit: "1" };
    const r = object(await get("data.json", query));
    const p = array(r.page).map((v) => {
      const vals = array(v);
      if (vals.length !== cols.length) throw Error("Width");
      return Object.fromEntries(cols.map((c, i) => [c, vals[i]]));
    });
    let files: unknown = null,
      metadata: unknown = null;
    if (p.length) {
      files = await get("files/" + string(p[0].opusid) + ".json");
      metadata = await get("metadata/" + string(p[0].opusid) + ".json");
    }
    results.push({
      id,
      query,
      available: r.available,
      sample: p[0] ?? null,
      files,
      metadata,
    });
    console.log(id + ": " + r.available + " matching records");
  },
  3,
);
await writeFile(
  workDir + "/products.json",
  JSON.stringify(results, null, 2) + "\n",
);
