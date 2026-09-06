import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

// Follow descriptor references, not a fixed source filename or private module.
export async function loadObjectContent(id) {
  const root = new URL(`../../src/planets/${id}/`, import.meta.url);
  const readJson = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
  const descriptor = await readJson("object.json");
  async function source(name) {
    const reference = descriptor.properties.recipe.sources.find(entry => entry.id === name);
    assert.ok(reference, `${id}: missing ${name} source reference`);
    const bytes = await readFile(new URL(reference.path, root));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), reference.sha256,
      `${id}: ${name} must match its descriptor pin`);
    return JSON.parse(bytes);
  }
  return { descriptor, source, prepared: await readJson("prepared/content.json"),
    object: await readJson("prepared/object.json") };
}
