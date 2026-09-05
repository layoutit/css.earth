import assert from "node:assert/strict";
import { existsSync, lstatSync, readlinkSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  CATALOGS_MANIFEST_FILE,
  EXCLUDED_CATALOGS,
  IDENTITY_RULES,
  LICENSE_FILE,
  PACKAGES,
  PROVENANCE_FILE,
  TARGETS,
  VENDORED_CATALOGS,
  applyIdentityRules,
  buildManifest,
  isOwnedFile,
  listVendoredFiles,
  manifestProblems,
  readProvenance,
  targetFor,
} from "./sync-galaxio.mjs";

const REQUIRED_FILES = {
  astronomy: [
    "package.json",
    "README.md",
    "AGENTS.md",
    "tsconfig.json",
    "src/index.ts",
    "src/frames.ts",
    "src/solarSystem.ts",
    "src/vsop87.ts",
    "src/elp2000.ts",
    "src/data/vsop87a.data.ts",
    "src/data/elp2000.data.ts",
    "src/__fixtures__/horizons.ts",
    "tools/generate-series.mjs",
  ],
  catalog: [
    "package.json",
    "README.md",
    "AGENTS.md",
    "FORMAT.md",
    "tsconfig.json",
    "src/index.ts",
    "src/format.ts",
    "src/read.ts",
    "src/write.ts",
    "scripts/check-parity.mjs",
  ],
};

// The identity rewrite may only ever touch these files in a package.
const REWRITABLE = ["package.json", "README.md", "AGENTS.md"];

const onDisk = ({ sha256, bytes, symlink }) => (symlink ? { symlink } : { sha256, bytes });

for (const id of TARGETS) {
  const target = targetFor(id);

  test(`${target.directory}: every vendored file matches its recorded copy`, async () => {
    assert.deepEqual(await manifestProblems(target), []);
  });

  test(`${target.directory}: the manifest is derived from disk, so a local edit would change it`, async () => {
    const { files, fileCount, byteCount } = await readProvenance(target);
    const rebuilt = await buildManifest(target);
    assert.deepEqual(
      rebuilt,
      Object.fromEntries(Object.entries(files).map(([path, entry]) => [path, onDisk(entry)])),
    );
    assert.equal(fileCount, Object.keys(rebuilt).length);
    assert.equal(
      byteCount,
      Object.values(rebuilt).reduce((sum, entry) => sum + (entry.bytes ?? 0), 0),
    );
    assert.equal(Object.keys(files).length, (await listVendoredFiles(target)).length);
  });

  test(`${target.directory}: cssEarth-owned provenance files exist and are not counted as upstream`, async () => {
    for (const owned of [PROVENANCE_FILE, "SOURCE.md", "NOTICE.md"]) {
      assert.ok(existsSync(join(target.dest, owned)), `${owned} exists`);
      assert.ok(isOwnedFile(target, owned));
    }
    const { files } = await readProvenance(target);
    for (const path of Object.keys(files)) assert.ok(!isOwnedFile(target, path), `${path} is upstream`);
  });
}

for (const pkg of PACKAGES) {
  const target = targetFor(pkg.id);

  test(`${pkg.directory}: the whole package directory is vendored, not just src`, async () => {
    const { files } = await readProvenance(target);
    for (const path of REQUIRED_FILES[pkg.id]) assert.ok(path in files, `${path} is vendored`);
    const testFiles = Object.keys(files).filter((path) => path.endsWith(".test.ts"));
    assert.ok(testFiles.length >= 1, `upstream tests are carried across (${testFiles.length})`);
    assert.equal(files["CLAUDE.md"]?.symlink, "AGENTS.md", "the CLAUDE.md symlink is preserved");
    const link = join(target.dest, "CLAUDE.md");
    assert.ok(lstatSync(link).isSymbolicLink());
    assert.equal(readlinkSync(link), "AGENTS.md");
  });

  test(`${pkg.directory}: provenance records the upstream commit and the open import question`, async () => {
    const provenance = await readProvenance(target);
    assert.equal(provenance.package, pkg.package);
    assert.equal(provenance.upstreamPackage, pkg.upstreamPackage);
    assert.equal(provenance.directory, pkg.upstreamDirectory);
    assert.equal(provenance.license, "MIT");
    assert.match(provenance.subtreeCommit, /^[0-9a-f]{40}$/);
    assert.match(provenance.headCommit, /^[0-9a-f]{40}$/);
    assert.equal(provenance.upstreamDirty, false);
    assert.ok(Number.isFinite(Date.parse(provenance.syncedAt)));
    assert.equal(provenance.syncScript, "tools/sync-galaxio.mjs");
    assert.match(provenance.transform, /identity only/);
    assert.match(provenance.importNote, /Node does not/);
    assert.match(provenance.importNote, /specifier rewrite|resolver hook|build step/);
    assert.deepEqual(
      Object.keys(provenance.identityRules).sort(),
      IDENTITY_RULES.map((rule) => rule.id).sort(),
    );
  });

  test(`${pkg.directory}: only the identity was rewritten, and only in prose and the package name`, async () => {
    const { files, rewrittenFiles } = await readProvenance(target);
    for (const path of Object.keys(rewrittenFiles)) {
      assert.ok(REWRITABLE.includes(path), `${path} may be identity-rewritten`);
      assert.notEqual(files[path].upstreamSha256, files[path].sha256);
      assert.deepEqual(files[path].identityRules, rewrittenFiles[path]);
    }
    for (const [path, entry] of Object.entries(files)) {
      if (path in rewrittenFiles) continue;
      assert.equal(entry.upstreamSha256, undefined, `${path} is byte-identical to upstream`);
      assert.equal(entry.identityRules, undefined);
    }
    for (const path of Object.keys(files)) {
      if (path.startsWith("src/") || path.startsWith("tools/") || path.startsWith("scripts/")) {
        assert.ok(!(path in rewrittenFiles), `${path} is code and stays verbatim`);
      }
    }
    const manifest = JSON.parse(await readFile(join(target.dest, "package.json"), "utf8"));
    assert.equal(manifest.name, pkg.package);
    const readme = await readFile(join(target.dest, "README.md"), "utf8");
    assert.doesNotMatch(readme, /@galaxio\//);
    assert.match(readme, new RegExp(`^# ${pkg.package.replace("/", "\\/")}`));
  });

  test(`${pkg.directory}: the vendored source is verbatim upstream, specifiers untouched`, async () => {
    const index = await readFile(join(target.dest, "src/index.ts"), "utf8");
    assert.match(index, /export \* from '\.\/[a-zA-Z0-9]+\.js'/);
    assert.doesNotMatch(index, /\.ts'/);
  });

  test(`${pkg.directory}: the MIT licence and attribution travel with the copy`, async () => {
    const license = await readFile(join(target.dest, LICENSE_FILE), "utf8");
    assert.match(license, /^MIT License/);
    assert.match(license, /Copyright \(c\) 2026 Juan Cruz Fortunatti/);
    assert.match(license, /Permission is hereby granted, free of charge/);
    const notice = await readFile(join(target.dest, "NOTICE.md"), "utf8");
    assert.match(notice, /MIT License/);
    assert.match(notice, new RegExp(LICENSE_FILE.replaceAll(".", "\\.")));
    assert.match(notice, new RegExp(pkg.upstreamPackage.replace("/", "\\/")));
  });
}

test("identity rules rewrite prose and the package name, and nothing in code", () => {
  const readme = Buffer.from(
    "# @galaxio/astronomy\n\nbehind [Galaxio](https://github.com/apresmoi/galaxio).\n" +
      "`pipeline/galaxio_pipeline/formats/catalog.py`\n",
  );
  const rewritten = applyIdentityRules("README.md", readme);
  assert.deepEqual(rewritten.applied, ["prose-package-name", "prose-project-link"]);
  assert.equal(
    rewritten.content.toString(),
    "# @cssearth/astronomy\n\nbehind [cssEarth](https://github.com/layoutit/cssEarth).\n" +
      "`pipeline/galaxio_pipeline/formats/catalog.py`\n",
  );

  const manifest = Buffer.from('{\n  "name": "@galaxio/catalog",\n  "homepage": "https://github.com/apresmoi/galaxio#readme"\n}\n');
  const renamed = applyIdentityRules("package.json", manifest);
  assert.deepEqual(renamed.applied, ["package-name"]);
  assert.match(renamed.content.toString(), /"name": "@cssearth\/catalog"/);
  assert.match(renamed.content.toString(), /apresmoi\/galaxio#readme/, "URLs are left alone");

  const code = Buffer.from("const PROJECT_SOURCE_URL = 'https://github.com/apresmoi/galaxio/blob/main/ARCHITECTURE.md'\n// @galaxio/astronomy\n");
  for (const path of ["src/modelAccuracy.ts", "scripts/gen_fixture.py", "tools/lib/sources.mjs"]) {
    const untouched = applyIdentityRules(path, code);
    assert.deepEqual(untouched.applied, []);
    assert.equal(untouched.content, code);
  }
});

const catalogs = targetFor("catalogs");

test("data/catalogs: exactly the vendored catalogues are present, each readable as .gxct", async () => {
  const provenance = await readProvenance(catalogs);
  assert.deepEqual(Object.keys(provenance.catalogs).sort(), Object.keys(VENDORED_CATALOGS).sort());
  for (const [name, record] of Object.entries(provenance.catalogs)) {
    assert.equal(record.key, `catalogs/${name}`);
    assert.ok(record.current in provenance.files, `${record.current} is vendored`);
    assert.equal(record.currentSha256, provenance.files[record.current].sha256);
    assert.equal(record.builder, VENDORED_CATALOGS[name]);
    assert.equal(provenance.files[record.current].bytes, record.manifestEntry.bytes);
    for (const superseded of record.supersededVersions) {
      assert.ok(superseded in provenance.files, `${superseded} is vendored`);
    }
    const bytes = await readFile(join(catalogs.dest, record.current));
    assert.equal(bytes.readUInt32LE(0), 0x54435847, `${name} starts with the GXCT magic`);
    assert.equal(bytes.readUInt32LE(4), 1, `${name} is format version 1`);
    const headerLength = bytes.readUInt32LE(8);
    const header = JSON.parse(bytes.subarray(16, 16 + headerLength).toString("utf8"));
    assert.equal(header.count, record.manifestEntry.extra.count, `${name} row count matches its manifest entry`);
    assert.equal(header.meta.source, record.manifestEntry.source);
    assert.equal(header.meta.built, record.manifestEntry.built);
  }
  for (const path of Object.keys(provenance.files)) {
    assert.match(path, /\.gxct$/, `${path} is catalogue data`);
    assert.ok(Object.keys(VENDORED_CATALOGS).includes(path.split("/")[0]));
  }
});

test("data/catalogs: manifest.json is the vendored subset of galaxio's data manifest", async () => {
  const provenance = await readProvenance(catalogs);
  const manifest = JSON.parse(await readFile(join(catalogs.dest, CATALOGS_MANIFEST_FILE), "utf8"));
  assert.equal(manifest.version, provenance.upstreamManifest.version);
  assert.deepEqual(
    manifest.assets,
    Object.fromEntries(
      Object.entries(provenance.catalogs).map(([, record]) => [record.key, record.manifestEntry]),
    ),
  );
  for (const record of Object.values(provenance.catalogs)) {
    assert.equal(record.manifestEntry.path, `catalogs/${record.current}`);
  }
});

test("data/catalogs: provenance is honest about the data having no upstream commit", async () => {
  const provenance = await readProvenance(catalogs);
  assert.equal(provenance.upstreamTracked, false);
  assert.match(provenance.upstreamTrackingNote, /gitignores data\//);
  assert.match(provenance.galaxioHeadCommit, /^[0-9a-f]{40}$/);
  assert.match(provenance.upstreamManifest.sha256, /^[0-9a-f]{64}$/);
  assert.match(provenance.transform, /^none:/);
  assert.match(provenance.licenseNote, /not MIT/);
  assert.ok(Number.isFinite(Date.parse(provenance.syncedAt)));
});

test("data/catalogs: galaxies and nebula-imagery are deliberately excluded, with reasons", async () => {
  const provenance = await readProvenance(catalogs);
  assert.deepEqual(Object.keys(provenance.excluded).sort(), Object.keys(EXCLUDED_CATALOGS).sort());
  assert.match(provenance.excluded.galaxies.reason, /licensing decision/);
  assert.match(provenance.excluded.galaxies.manifestEntry.license, /requires permission/);
  assert.match(provenance.excluded["nebula-imagery"].reason, /Not self-contained/);
  for (const name of Object.keys(EXCLUDED_CATALOGS)) {
    assert.ok(!existsSync(join(catalogs.dest, name)), `${name} is not on disk`);
    assert.ok(!(name in provenance.catalogs));
  }
  const source = await readFile(join(catalogs.dest, "SOURCE.md"), "utf8");
  assert.match(source, /galaxies/);
  assert.match(source, /J\/AJ\/144\/4/);
  assert.match(source, /nebula-imagery/);
});

test("data/catalogs: every catalogue's licence and attribution are spelled out beside the data", async () => {
  const provenance = await readProvenance(catalogs);
  const notice = await readFile(join(catalogs.dest, "NOTICE.md"), "utf8");
  for (const [name, record] of Object.entries(provenance.catalogs)) {
    const { license, source, url } = record.manifestEntry;
    assert.ok(notice.includes(`catalogs/${name}`), `NOTICE.md covers ${name}`);
    assert.ok(notice.includes(license), `NOTICE.md states ${name}'s terms: ${license}`);
    assert.ok(notice.includes(source), `NOTICE.md credits ${name}'s source`);
    assert.ok(notice.includes(url), `NOTICE.md links ${name}'s terms`);
  }
  const licenseFiles = [...notice.matchAll(/`(LICENSE\.[A-Za-z0-9.-]+\.md)`/g)].map((m) => m[1]);
  assert.ok(licenseFiles.length >= 4, "NOTICE.md points at the licence files");
  for (const file of new Set(licenseFiles)) {
    assert.ok(existsSync(join(catalogs.dest, file)), `${file} exists`);
    assert.ok(isOwnedFile(catalogs, file));
  }
  assert.doesNotMatch(notice, /MIT/, "no catalogue is presented as MIT");
});
