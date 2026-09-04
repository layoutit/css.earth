#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  createPreparedTitle,
  serializePreparedTitleModule,
  sha256,
} from "../../../platform/prepared-title.mjs";
import { MARS_TITLE_SOURCE } from "../source/presentation/title-mark.mjs";
import { validateMarsSourceGroup } from "./source-manifest.mjs";

const sourcePath = resolve(import.meta.dirname, "../source/presentation/title-mark.mjs");
const outputPath = resolve(import.meta.dirname, "../site/preparedTitle.mjs");

await validateMarsSourceGroup("title");
const title = createPreparedTitle(MARS_TITLE_SOURCE, {
  inputSha256: sha256(await readFile(sourcePath)),
  generator: "src/planets/mars/tools/prepare-title.mjs",
});
await writeFile(
  outputPath,
  serializePreparedTitleModule("PREPARED_MARS_TITLE", title),
);
