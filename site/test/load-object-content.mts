import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { requireArray, requireRecord, requireString } from "../../tools/source-values.mts";

interface SourceReference {
  readonly id: string;
  readonly path: string;
}

interface ObjectDescriptor extends Record<string, unknown> {
  readonly properties: {
    readonly recipe: {
      readonly sources: readonly SourceReference[];
    };
  };
}

interface LoadedObjectContent {
  readonly descriptor: ObjectDescriptor;
  source(name: string): Promise<Record<string, unknown>>;
  readonly prepared: Record<string, unknown>;
  readonly object: Record<string, unknown>;
}

// Follow descriptor references, not a fixed source filename or private module.
export async function loadObjectContent(id: string): Promise<LoadedObjectContent> {
  const root = new URL(`../../src/objects/${id}/`, import.meta.url);
  const readJson = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, root), "utf8"));
  const descriptor = requireDescriptor(await readJson("object.json"), `${id}: object descriptor`);
  async function source(name: string): Promise<Record<string, unknown>> {
    const reference = descriptor.properties.recipe.sources.find(entry => entry.id === name);
    assert.ok(reference, `${id}: missing ${name} source reference`);
    const bytes = await readFile(new URL(reference.path, root));
    const manifest = requireRecord(await readJson("source/manifest.json"), `${id}: source manifest`);
    const pin = ["inputs", "documents", "generatedIntermediates"].flatMap(key => requireArray(manifest[key] ?? [], key).map(entry => requireRecord(entry, key)))
      .find(entry => `source/${String(entry.path)}` === reference.path);
    assert.ok(pin, `${id}: ${name} is declared in the source manifest`);
    // A download carries a pin; a file authored and tracked here carries none.
    if (pin.expectedSha256 !== undefined) assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.expectedSha256, `${id}: ${name} must match its manifest pin`);
    return requireRecord(JSON.parse(bytes.toString("utf8")), `${id}: ${name} source`);
  }
  return { descriptor, source, prepared: requireRecord(await readJson("prepared/content.json"), `${id}: prepared content`),
    object: requireRecord(await readJson("prepared/object.json"), `${id}: prepared object`) };
}

function requireDescriptor(value: unknown, label: string): ObjectDescriptor {
  const descriptor = requireRecord(value, label);
  const properties = requireRecord(descriptor.properties, `${label}.properties`);
  const recipe = requireRecord(properties.recipe, `${label}.properties.recipe`);
  const sources = requireArray(recipe.sources, `${label}.properties.recipe.sources`).map((entry, index): SourceReference => {
    const source = requireRecord(entry, `${label}.properties.recipe.sources[${index}]`);
    return { id: requireString(source.id, `${label} source id`), path: requireString(source.path, `${label} source path`) };
  });
  return { ...descriptor, properties: { ...properties, recipe: { ...recipe, sources } } };
}
