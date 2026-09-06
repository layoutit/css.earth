// Receipts from the 34,310-record source snapshot: search 10.4 MB, directory
// below 1 MB, detail shards below 128 KB. Leave bounded room for ADM1 records.
export const DESTINATION_LIMITS = Object.freeze({
  directoryBytes: 2 * 1024 * 1024, searchBytes: 16 * 1024 * 1024,
  detailBytes: 256 * 1024, detailCacheBytes: 4 * 1024 * 1024,
  detailCachePacks: 16, recordsPerPack: 128, entities: 100000,
  aliases: 600000, packs: 1024, parentDepth: 8,
});

export function validateDestinationReference(ref, capacity) {
  if (!ref || !/^\/scenes\/[^?#]+\.pack$/u.test(ref.url ?? "") || ref.url.includes("..") ||
      ref.encoding !== "gzip" || !Number.isSafeInteger(ref.bytes) || ref.bytes < 1 || ref.bytes > capacity ||
      !Number.isSafeInteger(ref.decodedBytes) || ref.decodedBytes < 1 || ref.decodedBytes > capacity ||
      !/^[a-f0-9]{64}$/u.test(ref.sha256 ?? "") || !/^[a-f0-9]{64}$/u.test(ref.decodedSha256 ?? "")) {
    throw new Error("Destination pack reference exceeds its pinned capacity.");
  }
}

export function validateDestinationDirectory(directory, count) {
  const { entries, packs, search, resources, lenses } = directory ?? {};
  if (directory?.schema !== "cssearth-destination-directory@1" || typeof directory.rootId !== "string" || !directory.rootId ||
      !Array.isArray(entries) || entries.length !== count || count < 1 || count > DESTINATION_LIMITS.entities ||
      !Array.isArray(packs) || !packs.length || packs.length > DESTINATION_LIMITS.packs ||
      !Array.isArray(resources) || resources.length > 1024 || !Array.isArray(lenses) || lenses.length > 1024) {
    throw new Error("Destination directory is incompatible.");
  }
  validateDestinationReference(search, DESTINATION_LIMITS.searchBytes);
  for (const pack of packs) validateDestinationReference(pack, DESTINATION_LIMITS.detailBytes);
  for (const [i, row] of entries.entries()) {
    if (!Array.isArray(row) || row.length !== 2 || typeof row[0] !== "string" || !row[0] ||
        (i > 0 && entries[i - 1][0] >= row[0]) || !Number.isInteger(row[1]) || row[1] < 0 || row[1] >= packs.length) {
      throw new Error("Destination directory addressing is invalid.");
    }
  }
  return directory;
}

export function validateDestinationSearch(index, count) {
  if (index?.schema !== "cssearth-destination-search@1" || !Array.isArray(index.rows) || index.rows.length !== count ||
      !Array.isArray(index.aliases) || index.aliases.length > DESTINATION_LIMITS.aliases || count > DESTINATION_LIMITS.entities) {
    throw new Error("Destination search is incompatible.");
  }
  for (const row of index.rows) if (row.length !== 4 || !row.every(value => typeof value === "string")) throw new Error("Invalid destination search row.");
  for (const [i, [alias, postings]] of index.aliases.entries()) {
    if (typeof alias !== "string" || !alias || (i > 0 && index.aliases[i - 1][0] >= alias) ||
        !Array.isArray(postings) || !postings.length || postings.length > count ||
        postings.some((id, j) => !Number.isInteger(id) || id < 0 || id >= count || (j > 0 && postings[j - 1] >= id))) {
      throw new Error("Invalid prepared destination postings.");
    }
  }
  return index;
}
