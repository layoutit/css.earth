import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import {
  PLANET_INFORMATION_SOURCES,
  validatePlanetInformationSnapshot,
} from "./planet-information-sources.mjs";
import { publishPlanetInformation } from "./prepare-planet-information.mjs";

test("publishes the complete prepared batch atomically", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "css-earth-editorial-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const outputDirectory = resolve(root, "planets");
  await publishPlanetInformation(preparedBatch(), { outputDirectory });

  const files = (await readdir(outputDirectory)).sort();
  assert.deepEqual(files, PLANET_INFORMATION_SOURCES
    .map(({ id }) => `${id}.json`).sort());
  for (const file of files) {
    validatePlanetInformationSnapshot(JSON.parse(
      await readFile(resolve(outputDirectory, file), "utf8"),
    ));
  }
});

test("restores the previous complete batch when publication fails", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "css-earth-editorial-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const outputDirectory = resolve(root, "planets");
  await mkdir(outputDirectory);
  await writeFile(resolve(outputDirectory, "previous.json"), "previous\n");

  const operations = {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
    async rename(from, to) {
      if (from.includes(".planets-staging-")) {
        const error = new Error("injected publication failure");
        error.code = "EIO";
        throw error;
      }
      await rename(from, to);
    },
  };

  await assert.rejects(
    publishPlanetInformation(preparedBatch(), { outputDirectory, fileOperations: operations }),
    /injected publication failure/,
  );
  assert.deepEqual(await readdir(outputDirectory), ["previous.json"]);
  assert.equal(await readFile(resolve(outputDirectory, "previous.json"), "utf8"), "previous\n");
});

test("preserves both publication and restoration failures", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "css-earth-editorial-"));
  context.after(() => rm(root, { force: true, recursive: true }));
  const outputDirectory = resolve(root, "planets");
  await mkdir(outputDirectory);
  await writeFile(resolve(outputDirectory, "previous.json"), "previous\n");

  const publicationFailure = new Error("injected publication failure");
  const restorationFailure = new Error("injected restoration failure");
  const operations = {
    mkdir,
    mkdtemp,
    readFile,
    rm,
    writeFile,
    async rename(from, to) {
      if (from.includes(".planets-staging-")) throw publicationFailure;
      if (from.includes(".planets-backup-")) throw restorationFailure;
      await rename(from, to);
    },
  };

  await assert.rejects(
    publishPlanetInformation(preparedBatch(), {
      outputDirectory,
      fileOperations: operations,
    }),
    (error) => {
      assert.match(error.message, /previous batch could not be restored/u);
      assert.match(error.message, /.planets-backup-/u);
      assert.ok(error.cause instanceof AggregateError);
      assert.deepEqual(error.cause.errors, [publicationFailure, restorationFailure]);
      return true;
    },
  );
});

function preparedBatch() {
  return PLANET_INFORMATION_SOURCES.map((source) => ({
    schemaVersion: 1,
    id: source.id,
    planet: source.name,
    title: source.expectedTitle,
    introduction: "Prepared introduction.",
    sections: Array.from({ length: 8 }, (_, index) => ({
      heading: `Section ${index + 1}`,
      paragraphs: ["Prepared paragraph."],
    })),
    sourceUrl: source.sourceUrl,
    sourceId: source.sourceId,
    modified: "2026-08-29T12:00:00",
    retrievedAt: "2026-08-30",
    credit: "NASA Science",
    recordApiUrl: source.recordApiUrl,
    blocksApiUrl: source.blocksApiUrl,
  }));
}
