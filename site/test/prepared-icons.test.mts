import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import { SourceEvidence } from "./source-evidence-values.mts";

import { sha256 } from "../../src/platform/sha256.mts";
import { prepareShellIcons } from "../../tools/prepare/prepare-shell-icons.mts";
import { PREPARED_SHELL_ICONS } from "../prepared-shell-icons.mjs";
import { SHELL_ICON_SOURCES } from "../source/icons/manifest.mts";

const projectRoot = resolve(import.meta.dirname, "../..");

test("prepares one source-bound 20px SVG family for sidebar sections", async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), "cssearth-shell-icons-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const publicRoot = resolve(root, "public");
  const moduleOutput = resolve(root, "prepared-shell-icons.mjs");
  const result = await prepareShellIcons({
    sourceRoot: resolve(projectRoot, "site/source/icons"),
    publicRoot,
    moduleOutput,
  });

  assert.equal(
    result.moduleSource,
    await readFile(resolve(projectRoot, "site/prepared-shell-icons.mjs"), "utf8"),
  );
  assert.deepEqual(Object.keys(result.prepared), [
    "facts",
    "reflectance",
    "temperaturePressure",
    "photometricPhase",
    "lenses",
    "resources",
  ]);
  for (const descriptor of SHELL_ICON_SOURCES.icons) {
    const source = await readFile(resolve(
      projectRoot,
      "site/source/icons",
      descriptor.file,
    ));
    const preparedSvg = await readFile(
      resolve(publicRoot, descriptor.outputFile),
      "utf8",
    );
    const icon = SourceEvidence.parse(PREPARED_SHELL_ICONS[descriptor.key]);
    assert.equal(sha256(source), descriptor.sourceSha256);
    assert.equal(icon.text("sourceSha256"), descriptor.sourceSha256);
    assert.equal(icon.field("width"), 20);
    assert.equal(icon.field("height"), 20);
    assert.equal(icon.text("family"), "Wikimedia Commons Unicode symbols");
    assert.equal(icon.text("glyph"), descriptor.glyph);
    assert.equal(icon.text("preparedSha256"), sha256(Buffer.from(preparedSvg)));
  }
});
