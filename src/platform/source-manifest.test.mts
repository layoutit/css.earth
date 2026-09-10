import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseSourceManifest } from '../../tools/objects/dist/operations.js';

import {
  validateSourceManifest,
  verifySourceManifest,
} from "./source-manifest.mts";

test('document descriptions are optional without weakening source pins or generator identity', () => {
  const base = sourceManifest({ 'input/source.txt': Buffer.from('input') });
  const { purpose, ...document } = base.documents[0];
  const manifest = { ...base, documents: [document] };
  for (const parse of [(value: unknown) => validateSourceManifest('fixture', value), (value: unknown) => parseSourceManifest(value, 'fixture')]) {
    assert.deepEqual(parse(manifest).documents[0], document);
    assert.throws(() => parse({ ...manifest, documents: [{ ...document, purpose: '' }] }), /empty purpose/);
    assert.throws(() => parse({ ...manifest, documents: [{ ...document, expectedSha256: 'invalid' }] }));
    assert.throws(() => parse({ ...manifest, generatedIntermediates: [{ ...base.generatedIntermediates[0], generator: '' }] }), /generator/);
  }
});

test("validates and verifies every authoritative source entry class", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-source-manifest-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(join(root, "input"));
  await mkdir(join(root, "generated"));
  await mkdir(join(root, "docs"));
  const files = Object.freeze({
    "input/source.txt": Buffer.from("input"),
    "generated/output.txt": Buffer.from("generated"),
    "docs/NOTICE.md": Buffer.from("notice"),
  });
  for (const [path, bytes] of Object.entries(files)) {
    await writeFile(join(root, path), bytes);
  }

  const valid = sourceManifest(files);
  const manifest = validateSourceManifest("fixture", valid);
  assert.deepEqual(await verifySourceManifest({
    manifest,
    planetName: "Fixture",
    sourceRoot: root,
  }), {
    inputCount: 1,
    generatedIntermediateCount: 1,
    documentCount: 1,
  });

  assert.throws(
    () => validateSourceManifest("fixture", sourceManifest(files, {
      input: { redistribution: "" },
    })),
    /has no redistribution/,
  );
  assert.throws(
    () => validateSourceManifest("fixture", sourceManifest(files, {
      input: { licenseEvidence: [] },
    })),
    /invalid license evidence/,
  );
  assert.throws(
    () => validateSourceManifest("fixture", sourceManifest(files, {
      input: { path: "../escape.txt" },
    })),
    /invalid source input/,
  );
  assert.throws(
    () => validateSourceManifest("fixture", {
      ...sourceManifest(files),
      documents: [{
        ...sourceManifest(files).documents[0],
        path: "input/source.txt",
      }],
    }),
    /repeats source path/,
  );

  await assert.rejects(
    verifySourceManifest({
      manifest: validateSourceManifest("fixture", sourceManifest(files, {
        input: { expectedBytes: files["input/source.txt"].byteLength + 1 },
      })),
      planetName: "Fixture",
      sourceRoot: root,
    }),
    /size drifted/,
  );
  await assert.rejects(
    verifySourceManifest({
      manifest: validateSourceManifest("fixture", sourceManifest(files, {
        input: { expectedSha256: "0".repeat(64) },
      })),
      planetName: "Fixture",
      sourceRoot: root,
    }),
    /hash drifted/,
  );

  await writeFile(join(root, "undeclared.txt"), "undeclared");
  await assert.rejects(
    verifySourceManifest({ manifest, planetName: "Fixture", sourceRoot: root }),
    /Undeclared: undeclared.txt/,
  );
});

test("rejects a declared file missing from the source tree", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-source-missing-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  const bytes = Buffer.from("input");
  const files = { "input/source.txt": bytes };
  const manifest = validateSourceManifest("fixture", {
    ...sourceManifest(files),
    generatedIntermediates: [],
    documents: [],
  });
  await assert.rejects(
    verifySourceManifest({ manifest, planetName: "Fixture", sourceRoot: root }),
    /Missing: input\/source.txt/,
  );
});

function sourceManifest(files: Record<string, Buffer>, overrides: Partial<Record<"input" | "generated" | "document", Record<string, unknown>>> = {}) {
  const inputBytes = files["input/source.txt"];
  const generatedBytes = files["generated/output.txt"] ?? Buffer.from("generated");
  const documentBytes = files["docs/NOTICE.md"] ?? Buffer.from("notice");
  return {
    schema: "cssfixture-authoritative-sources@2",
    inputs: [{
      id: "source",
      path: "input/source.txt",
      expectedBytes: inputBytes.byteLength,
      expectedSha256: digest(inputBytes),
      origin: "https://example.test/source.txt",
      credit: "Fixture authority",
      license: "Fixture license",
      acquisition: "Fixture acquisition",
      redistribution: "Fixture redistribution",
      sourceBinding: {kind: 'local', reason: 'Authored test fixture'}, consumers: ["fixture"],
      ...overrides.input,
    }],
    generatedIntermediates: [{
      path: "generated/output.txt",
      expectedBytes: generatedBytes.byteLength,
      expectedSha256: digest(generatedBytes),
      generator: "fixture generator",
      ...overrides.generated,
    }],
    documents: [{
      path: "docs/NOTICE.md",
      expectedBytes: documentBytes.byteLength,
      expectedSha256: digest(documentBytes),
      purpose: "Fixture attribution",
      ...overrides.document,
    }],
  };
}

function digest(bytes: Buffer) {
  return createHash("sha256").update(bytes).digest("hex");
}

test("streamed verification detects late corruption and truncation across file chunks", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "cssearth-source-chunks-"));
  t.after(() => rm(root, { force: true, recursive: true }));
  await mkdir(join(root, "input"));
  const bytes = Buffer.alloc(200003, 73);
  bytes[131079] = 29;
  const manifest = sourceManifest({ "input/source.txt": bytes });
  manifest.generatedIntermediates = []; manifest.documents = [];
  const verify = () => verifySourceManifest({ manifest, planetName: "Fixture", sourceRoot: root });
  await writeFile(join(root, "input/source.txt"), bytes);
  await verify();
  const corrupt = Buffer.from(bytes); corrupt[199999] ^= 1;
  await writeFile(join(root, "input/source.txt"), corrupt);
  await assert.rejects(verify(), /hash drifted/);
  await writeFile(join(root, "input/source.txt"), bytes.subarray(0, -1));
  await assert.rejects(verify(), /size drifted/);
});
