#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createPreparedTitle, serializePreparedTitleModule, sha256 } from "../../../platform/prepared-title.mjs";
import { NEPTUNE_TITLE_SOURCE } from "../source/presentation/title-mark.mjs";
import { validateNeptuneSourceGroup } from "./source-manifest.mjs";

const sourcePath = resolve(import.meta.dirname, "../source/presentation/title-mark.mjs");
await validateNeptuneSourceGroup("title");
const title = createPreparedTitle(NEPTUNE_TITLE_SOURCE, {
  inputSha256: sha256(await readFile(sourcePath)),
  generator: "src/planets/neptune/tools/prepare-title.mjs",
});
await writeFile(resolve(import.meta.dirname, "../site/preparedTitle.mjs"), serializePreparedTitleModule("PREPARED_NEPTUNE_TITLE", title));

