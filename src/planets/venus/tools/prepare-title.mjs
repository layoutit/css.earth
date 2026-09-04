#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createPreparedTitle,
  serializePreparedTitleModule,
  sha256,
} from "../../../platform/prepared-title.mjs";
import { VENUS_TITLE_SOURCE } from "../source/presentation/title-mark.mjs";
import { validateVenusSourceGroup } from "./source-manifest.mjs";

const sourcePath = resolve(import.meta.dirname, "../source/presentation/title-mark.mjs");
const outputPath = resolve(import.meta.dirname, "../site/preparedTitle.mjs");

await validateVenusSourceGroup("title");
const title = createPreparedTitle(VENUS_TITLE_SOURCE, {
  inputSha256: sha256(await readFile(sourcePath)),
  generator: "src/planets/venus/tools/prepare-title.mjs",
});
await writeFile(
  outputPath,
  serializePreparedTitleModule("PREPARED_VENUS_TITLE", title),
);
