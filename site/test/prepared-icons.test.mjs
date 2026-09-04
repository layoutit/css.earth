import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { sha256 } from "../../src/platform/prepared-title.mjs";
import { prepareShellIcons } from "../../tools/prepare-shell-icons.mjs";
import { PREPARED_SHELL_ICONS } from "../prepared-shell-icons.mjs";
import { SHELL_ICON_SOURCES } from "../source/icons/manifest.mjs";

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
    const icon = PREPARED_SHELL_ICONS[descriptor.key];
    assert.equal(sha256(source), descriptor.sourceSha256);
    assert.equal(icon.sourceSha256, descriptor.sourceSha256);
    assert.equal(icon.width, 20);
    assert.equal(icon.height, 20);
    assert.equal(icon.family, "Wikimedia Commons Unicode symbols");
    assert.equal(icon.glyph, descriptor.glyph);
    assert.match(preparedSvg, /#aaa/u);
    assert.doesNotMatch(preparedSvg, /fill="black"/u);
    assert.equal(icon.preparedSha256, sha256(Buffer.from(preparedSvg)));
  }
});
