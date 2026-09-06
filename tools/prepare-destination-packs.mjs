import { gzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { DESTINATION_LIMITS, validateDestinationDirectory, validateDestinationSearch, validateDestinationReference } from "../src/platform/prepared-destination-contract.mjs";

// Source normalization and ranking belong to the supplying object preparer.
// This writer only packs its prepared records into independently pinned units.
export function prepareDestinationPacks(catalog, assetPath) {
  const outputs = new Map();
  const hash = bytes => createHash("sha256").update(bytes).digest("hex");
  function pack(value, label, capacity) {
    const decoded = Buffer.from(JSON.stringify(value) + "\n"), bytes = gzipSync(decoded, { level: 9 });
    const sha256 = hash(bytes), url = `${assetPath}destinations-${label}-${sha256.slice(0, 16)}.pack`;
    const ref = { url, bytes: bytes.length, encoding: "gzip", sha256, decodedBytes: decoded.length, decodedSha256: hash(decoded) };
    validateDestinationReference(ref, capacity); outputs.set(url, bytes);
    return ref;
  }
  const aliases = new Map();
  const rows = catalog.places.map((place, i) => {
    for (const name of place.names) {
      if (!name) continue;
      if (!aliases.has(name)) aliases.set(name, []);
      aliases.get(name).push(i);
    }
    return [place.id, place.name, place.context, place.searchContext];
  });
  const lexical = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  const searchData = validateDestinationSearch({ schema: "cssearth-destination-search@1", rows,
    aliases: [...aliases].sort(([a], [b]) => lexical(a, b)) }, rows.length);
  const search = pack(searchData, "search", DESTINATION_LIMITS.searchBytes);
  const resources = [], lenses = [], dictionaries = [new Map(), new Map()];
  function intern(values, target, lookup) {
    return values.map(value => {
      const key = JSON.stringify(value);
      if (!lookup.has(key)) { lookup.set(key, target.length); target.push(value); }
      return lookup.get(key);
    });
  }
  const entries = [], packs = [], sorted = [...catalog.places].sort((a, b) => lexical(a.id, b.id));
  for (let offset = 0; offset < sorted.length; offset += DESTINATION_LIMITS.recordsPerPack) {
    const records = sorted.slice(offset, offset + DESTINATION_LIMITS.recordsPerPack).map(place => {
      const { names, searchContext, resources: sources, lenses: observations, ...record } = place;
      entries.push([record.id, packs.length]);
      return { ...record, resourceRefs: intern(sources, resources, dictionaries[0]), lensRefs: intern(observations, lenses, dictionaries[1]) };
    });
    packs.push(pack({ schema: "cssearth-destination-details@1", records }, "details", DESTINATION_LIMITS.detailBytes));
  }
  const { places, ...provenance } = catalog;
  const directory = validateDestinationDirectory({ ...provenance, schema: "cssearth-destination-directory@1",
    entries, packs, search, resources, lenses }, rows.length);
  const reference = { ...pack(directory, "directory", DESTINATION_LIMITS.directoryBytes), format: "indexed", count: rows.length };
  const receipt = { count: rows.length, aliases: aliases.size, packs: packs.length, search, directory: reference,
    details: { encodedBytes: packs.reduce((n, p) => n + p.bytes, 0), decodedBytes: packs.reduce((n, p) => n + p.decodedBytes, 0),
      maximumEncodedBytes: Math.max(...packs.map(p => p.bytes)), maximumDecodedBytes: Math.max(...packs.map(p => p.decodedBytes)) },
    limits: DESTINATION_LIMITS };
  return { reference, directory, search: searchData, outputs, receipt };
}
