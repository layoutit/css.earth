import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  requireArray,
  requireFiniteNumber,
  requireRecord,
  requireString,
} from "../sources/source-values.mts";

import {
  AUTHOR,
  CATALOGS_MANIFEST_FILE,
  EXCLUDED_CATALOGS,
  EXCLUDED_FILES,
  IDENTITY_RULES,
  LICENSE_FILE,
  PACKAGES,
  PROVENANCE_FILE,
  TARGETS,
  UPSTREAM_NAME,
  VENDORED_CATALOGS,
  applyIdentityRules,
  buildManifest,
  isOwnedFile,
  listFiles,
  locallyMaintainedFile,
  listVendoredFiles,
  manifestProblems,
  readProvenance,
  targetFor,
} from "./sync-upstream.mts";

const REQUIRED_FILES: Record<string, readonly string[]> = {
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

// The identity rewrite may only ever touch these files in a package. The one
// file under src/ may only be touched by the two string-literal rules.
const REWRITABLE = ["package.json", "README.md", "AGENTS.md", "FORMAT.md", "src/modelAccuracy.ts"];
const CODE_RULES = ["code-project-url", "code-convention-label"];
const EXCLUDED_FILE_REASONS: Record<string, string> = { ...EXCLUDED_FILES };
const VENDORED_CATALOG_BUILDERS: Record<string, string> = { ...VENDORED_CATALOGS };

// upstream.json is the one place the other project may be named, and only in
// these provenance fields (what it is, where it lives, what was rewritten).
const PROVENANCE_FIELDS_NAMING_UPSTREAM = ["upstreamPackage", "origin", "repository", "identityRules", "excludedFiles"];
const NAMES_UPSTREAM = new RegExp(UPSTREAM_NAME, "i");

type FileRecord = {
  sha256?: string;
  bytes?: number;
  symlink?: string;
  upstreamSha256?: string;
  identityRules?: string[];
};

type FileManifest = Record<string, FileRecord>;
type AssetEntry = Record<string, unknown> & {
  path: string;
  bytes: number;
  source: string;
  license: string;
  url: string;
  built: string;
  extra: Record<string, unknown> & { count: number };
};
type ExcludedAssetEntry = Record<string, unknown> & {
  path: string;
  bytes: number;
  source: string;
  license: string;
  url: string;
  built: string;
};
type CatalogRecord = {
  key: string;
  current: string;
  currentSha256?: string;
  supersededVersions: string[];
  builder: string;
  manifestEntry: AssetEntry;
};

const requireBoolean = (value: unknown, label: string): boolean => {
  if (typeof value !== "boolean") throw new TypeError(`${label} must be a boolean.`);
  return value;
};

const requireStringArray = (value: unknown, label: string): string[] =>
  requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));

const requireStringMap = (value: unknown, label: string): Record<string, string> =>
  Object.fromEntries(
    Object.entries(requireRecord(value, label)).map(([key, entry]) => [key, requireString(entry, `${label}.${key}`)]),
  );

const requireFileRecord = (value: unknown, label: string): FileRecord => {
  const input = requireRecord(value, label);
  if (input.symlink !== undefined) return { symlink: requireString(input.symlink, `${label}.symlink`) };
  return {
    ...input,
    sha256: requireString(input.sha256, `${label}.sha256`),
    bytes: requireFiniteNumber(input.bytes, `${label}.bytes`),
    ...(input.upstreamSha256 === undefined ? {} : { upstreamSha256: requireString(input.upstreamSha256, `${label}.upstreamSha256`) }),
    ...(input.identityRules === undefined ? {} : { identityRules: requireStringArray(input.identityRules, `${label}.identityRules`) }),
  };
};

const requireFileManifest = (value: unknown, label: string): FileManifest =>
  Object.fromEntries(
    Object.entries(requireRecord(value, label)).map(([path, entry]) => [path, requireFileRecord(entry, `${label}.${path}`)]),
  );

const requireFilesProvenance = (value: unknown) => {
  const input = requireRecord(value, "upstream provenance");
  return { files: requireFileManifest(input.files, "upstream provenance.files") };
};

const requirePackageProvenance = (value: unknown) => {
  const input = requireRecord(value, "package provenance");
  return {
    files: requireFileManifest(input.files, "package provenance.files"),
    package: requireString(input.package, "package provenance.package"),
    upstreamPackage: requireString(input.upstreamPackage, "package provenance.upstreamPackage"),
    directory: requireString(input.directory, "package provenance.directory"),
    license: requireString(input.license, "package provenance.license"),
    subtreeCommit: requireString(input.subtreeCommit, "package provenance.subtreeCommit"),
    headCommit: requireString(input.headCommit, "package provenance.headCommit"),
    upstreamDirty: requireBoolean(input.upstreamDirty, "package provenance.upstreamDirty"),
    syncedAt: requireString(input.syncedAt, "package provenance.syncedAt"),
    syncScript: requireString(input.syncScript, "package provenance.syncScript"),
    author: requireString(input.author, "package provenance.author"),
    origin: requireString(input.origin, "package provenance.origin"),
    transform: requireString(input.transform, "package provenance.transform"),
    importNote: requireString(input.importNote, "package provenance.importNote"),
    identityRules: requireStringMap(input.identityRules, "package provenance.identityRules"),
    rewrittenFiles: Object.fromEntries(Object.entries(requireRecord(input.rewrittenFiles, "package provenance.rewrittenFiles")).map(([path, rules]) => [path, requireStringArray(rules, `package provenance.rewrittenFiles.${path}`)])),
    excludedFiles: requireStringMap(input.excludedFiles, "package provenance.excludedFiles"),
    locallyMaintainedFiles: requireStringArray(input.locallyMaintainedFiles, "package provenance.locallyMaintainedFiles"),
    locallyMaintainedOrigins: requireRecord(input.locallyMaintainedOrigins, "package provenance.locallyMaintainedOrigins"),
    fileCount: requireFiniteNumber(input.fileCount, "package provenance.fileCount"),
    byteCount: requireFiniteNumber(input.byteCount, "package provenance.byteCount"),
  };
};

const requireAssetEntry = (value: unknown, label: string): AssetEntry => {
  const input = requireRecord(value, label);
  const extra = requireRecord(input.extra, `${label}.extra`);
  return {
    ...input,
    path: requireString(input.path, `${label}.path`),
    bytes: requireFiniteNumber(input.bytes, `${label}.bytes`),
    source: requireString(input.source, `${label}.source`),
    license: requireString(input.license, `${label}.license`),
    url: requireString(input.url, `${label}.url`),
    built: requireString(input.built, `${label}.built`),
    extra: { ...extra, count: requireFiniteNumber(extra.count, `${label}.extra.count`) },
  };
};

const requireExcludedAssetEntry = (value: unknown, label: string): ExcludedAssetEntry => {
  const input = requireRecord(value, label);
  return {
    ...input,
    path: requireString(input.path, `${label}.path`),
    bytes: requireFiniteNumber(input.bytes, `${label}.bytes`),
    source: requireString(input.source, `${label}.source`),
    license: requireString(input.license, `${label}.license`),
    url: requireString(input.url, `${label}.url`),
    built: requireString(input.built, `${label}.built`),
  };
};

const requireCatalogProvenance = (value: unknown) => {
  const input = requireRecord(value, "catalog provenance");
  const catalogs: Record<string, CatalogRecord> = {};
  for (const [name, entry] of Object.entries(requireRecord(input.catalogs, "catalog provenance.catalogs"))) {
    const record = requireRecord(entry, `catalog provenance.catalogs.${name}`);
    catalogs[name] = {
      key: requireString(record.key, `catalog provenance.catalogs.${name}.key`),
      current: requireString(record.current, `catalog provenance.catalogs.${name}.current`),
      currentSha256: record.currentSha256 === undefined ? undefined : requireString(record.currentSha256, `catalog provenance.catalogs.${name}.currentSha256`),
      supersededVersions: requireStringArray(record.supersededVersions, `catalog provenance.catalogs.${name}.supersededVersions`),
      builder: requireString(record.builder, `catalog provenance.catalogs.${name}.builder`),
      manifestEntry: requireAssetEntry(record.manifestEntry, `catalog provenance.catalogs.${name}.manifestEntry`),
    };
  }
  const excluded: Record<string, { reason: string; manifestEntry: ExcludedAssetEntry | null }> = {};
  for (const [name, entry] of Object.entries(requireRecord(input.excluded, "catalog provenance.excluded"))) {
    const record = requireRecord(entry, `catalog provenance.excluded.${name}`);
    excluded[name] = {
      reason: requireString(record.reason, `catalog provenance.excluded.${name}.reason`),
      manifestEntry: record.manifestEntry === null ? null : requireExcludedAssetEntry(record.manifestEntry, `catalog provenance.excluded.${name}.manifestEntry`),
    };
  }
  const upstreamManifest = requireRecord(input.upstreamManifest, "catalog provenance.upstreamManifest");
  return {
    files: requireFileManifest(input.files, "catalog provenance.files"),
    catalogs,
    excluded,
    upstreamTracked: requireBoolean(input.upstreamTracked, "catalog provenance.upstreamTracked"),
    upstreamTrackingNote: requireString(input.upstreamTrackingNote, "catalog provenance.upstreamTrackingNote"),
    galaxioHeadCommit: requireString(input.galaxioHeadCommit, "catalog provenance.galaxioHeadCommit"),
    upstreamManifest: { sha256: requireString(upstreamManifest.sha256, "catalog provenance.upstreamManifest.sha256"), version: requireFiniteNumber(upstreamManifest.version, "catalog provenance.upstreamManifest.version") },
    transform: requireString(input.transform, "catalog provenance.transform"),
    licenseNote: requireString(input.licenseNote, "catalog provenance.licenseNote"),
    syncedAt: requireString(input.syncedAt, "catalog provenance.syncedAt"),
    fileCount: requireFiniteNumber(input.fileCount, "catalog provenance.fileCount"),
    byteCount: requireFiniteNumber(input.byteCount, "catalog provenance.byteCount"),
  };
};

const onDisk = ({ sha256, bytes, symlink }: FileRecord) => (symlink ? { symlink } : { sha256, bytes });

for (const id of TARGETS) {
  const target = targetFor(id);

  test(`${target.directory}: every vendored file matches its recorded copy`, async () => {
    assert.deepEqual(await manifestProblems(target), []);
  });

  test(`${target.directory}: the manifest is derived from disk, so a local edit would change it`, async () => {
    const { files, fileCount, byteCount } = target.kind === "package"
      ? requirePackageProvenance(await readProvenance(target))
      : requireCatalogProvenance(await readProvenance(target));
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
    const { files } = requireFilesProvenance(await readProvenance(target));
    for (const path of Object.keys(files)) assert.ok(!isOwnedFile(target, path), `${path} is upstream`);
  });
}

for (const pkg of PACKAGES) {
  const target = targetFor(pkg.id);

  test(`${pkg.directory}: the whole package directory is vendored, not just src`, async () => {
    const { files } = requirePackageProvenance(await readProvenance(target));
    for (const path of REQUIRED_FILES[pkg.id]) assert.ok(path in files || locallyMaintainedFile(target, path), `${path} is mirrored or explicitly maintained locally`);
    const testFiles = Object.keys(files).filter((path) => path.endsWith(".test.ts"));
    assert.ok(testFiles.length >= 1, `upstream tests are carried across (${testFiles.length})`);
  });

  test(`${pkg.directory}: the excluded upstream files are absent, and recorded with their reasons`, async () => {
    const { files, excludedFiles } = requirePackageProvenance(await readProvenance(target));
    for (const [path, reason] of Object.entries(excludedFiles)) {
      assert.equal(reason, EXCLUDED_FILE_REASONS[path], `${path} is excluded for the declared reason`);
      assert.ok(!(path in files), `${path} is not in the manifest`);
      assert.ok(!existsSync(join(target.dest, path)), `${path} is not on disk`);
    }
    assert.ok(locallyMaintainedFile(target, "CLAUDE.md"));
    assert.ok(existsSync(join(target.dest, "CLAUDE.md")), "local CLAUDE.md guide exists");
    assert.ok(!Object.values(files).some((entry) => "symlink" in entry), "no symlink is mirrored");
    if (pkg.id === "catalog") {
      assert.ok("scripts/gen_fixture.py" in excludedFiles, "gen_fixture.py is excluded");
    }
  });

  test(`${pkg.directory}: provenance records the upstream commit and the import decision`, async () => {
    const provenance = requirePackageProvenance(await readProvenance(target));
    assert.equal(provenance.package, pkg.package);
    assert.equal(provenance.upstreamPackage, pkg.upstreamPackage);
    assert.equal(provenance.directory, pkg.upstreamDirectory);
    assert.equal(provenance.license, "MIT");
    assert.match(provenance.subtreeCommit, /^[0-9a-f]{40}$/);
    assert.match(provenance.headCommit, /^[0-9a-f]{40}$/);
    assert.equal(provenance.upstreamDirty, false);
    assert.ok(Number.isFinite(Date.parse(provenance.syncedAt)));
    assert.ok(["tools/sync-upstream.mjs", "tools/ci/sync-upstream.mts"].includes(provenance.syncScript), "the receipt retains the sync owner used at that time");
    assert.equal(provenance.author, AUTHOR);
    assert.match(provenance.origin, /same author/);
    assert.match(provenance.origin, /not a third-party attribution/);
    assert.match(provenance.transform, /identity only/);
    assert.match(provenance.importNote, /Node does not/);
    assert.match(provenance.importNote, /build step/);
    assert.match(provenance.importNote, /pnpm build:astronomy/);
    assert.deepEqual(
      Object.keys(provenance.identityRules).sort(),
      IDENTITY_RULES.map((rule) => rule.id).sort(),
    );
  });

  test(`${pkg.directory}: only the identity was rewritten, in prose, package metadata, and two code strings`, async () => {
    const { files, rewrittenFiles } = requirePackageProvenance(await readProvenance(target));
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
      if (path === "src/modelAccuracy.ts") {
        for (const rule of rewrittenFiles[path] ?? []) {
          assert.ok(CODE_RULES.includes(rule), `${path} is only touched by the string-literal rules (${rule})`);
        }
      } else if (path.startsWith("src/") || path.startsWith("tools/") || path.startsWith("scripts/")) {
        assert.ok(!(path in rewrittenFiles), `${path} is code and stays verbatim`);
      }
    }
    for (const rule of IDENTITY_RULES) {
      if (CODE_RULES.includes(rule.id)) assert.equal(String(rule.files), String(/^src\/modelAccuracy\.ts$/));
      else assert.ok(!rule.files.test("src/anything.ts"), `${rule.id} cannot reach src/`);
    }
    const manifest = JSON.parse(await readFile(join(target.dest, "package.json"), "utf8"));
    assert.equal(manifest.name, pkg.package);
    assert.equal(manifest.repository.url, "https://github.com/layoutit/cssEarth.git");
    assert.equal(manifest.repository.directory, pkg.directory);
    assert.equal(manifest.bugs.url, "https://github.com/layoutit/cssEarth/issues");
    assert.equal(manifest.homepage, "https://github.com/layoutit/cssEarth#readme");
    const readme = await readFile(join(target.dest, "README.md"), "utf8");
    assert.match(readme, new RegExp(`^# ${pkg.package.replace("/", "\\/")}`));
    const agents = await readFile(join(target.dest, "AGENTS.md"), "utf8");
    assert.match(agents, /CLAUDE\.md/, "AGENTS.md documents its local symlink");
  });

  test(`${pkg.directory}: nothing in the directory names the other project, except upstream.json's provenance fields`, async () => {
    for (const path of await listFiles(target.dest)) {
      const rel = path.slice(target.dest.length + 1);
      if (rel === PROVENANCE_FILE) continue;
      assert.doesNotMatch(await readFile(path, "utf8"), NAMES_UPSTREAM, `${rel} does not name ${UPSTREAM_NAME}`);
    }
    const provenance = await readProvenance(target);
    for (const [key, value] of Object.entries(provenance)) {
      if (PROVENANCE_FIELDS_NAMING_UPSTREAM.includes(key)) continue;
      assert.doesNotMatch(JSON.stringify(value), NAMES_UPSTREAM, `upstream.json ${key} does not name ${UPSTREAM_NAME}`);
    }
    for (const path of ["FORMAT.md", "AGENTS.md", "README.md"]) {
      const file = join(target.dest, path);
      if (!existsSync(file)) continue;
      const text = await readFile(file, "utf8");
      assert.doesNotMatch(text, /pipeline\/[a-z_]+\/formats/, `${path} cites no path into a pipeline this repo lacks`);
      assert.doesNotMatch(text, /ARCHITECTURE\.md/, `${path} cites no root ARCHITECTURE.md this repo lacks`);
    }
  });

  test(`${pkg.directory}: the vendored source is verbatim upstream, specifiers untouched`, async () => {
    const index = await readFile(join(target.dest, "src/index.ts"), "utf8");
    assert.match(index, /export \* from '\.\/[a-zA-Z0-9]+\.js'/);
    assert.doesNotMatch(index, /\.ts'/);
  });

  test(`${pkg.directory}: the package carries its own MIT licence under the author's copyright`, async () => {
    assert.equal(LICENSE_FILE, "LICENSE");
    const license = await readFile(join(target.dest, LICENSE_FILE), "utf8");
    assert.match(license, /^MIT License/);
    assert.match(license, new RegExp(`Copyright \\(c\\) 2026 ${AUTHOR}`));
    assert.match(license, /Permission is hereby granted, free of charge/);
    assert.ok(!existsSync(join(target.dest, "LICENSE.GALAXIO-MIT")), "no separately-branded licence file remains");
    const notice = await readFile(join(target.dest, "NOTICE.md"), "utf8");
    assert.match(notice, /MIT License/);
    assert.match(notice, /`LICENSE`/);
    assert.match(notice, new RegExp(pkg.package.replace("/", "\\/")));
    assert.match(notice, new RegExp(AUTHOR));
    assert.match(notice, /cssEarth's own package/);
  });
}

test("identity rules rewrite prose, package metadata, foreign paths, and two code string literals", () => {
  const readme = Buffer.from(
    "# @galaxio/astronomy\n\nbehind [Galaxio](https://github.com/apresmoi/galaxio).\n" +
      "`pipeline/galaxio_pipeline/formats/catalog.py`\n" +
      "See `ARCHITECTURE.md §2` in the repo root for why that matters across 26 orders.\n" +
      "A Python writer lives in the repo's `pipeline/`; `pnpm check:parity` proves it.\n",
  );
  const rewritten = applyIdentityRules("README.md", readme);
  assert.deepEqual(rewritten.applied, [
    "prose-package-name",
    "prose-project-link",
    "prose-pipeline-writer-path",
    "prose-pipeline-directory",
    "prose-architecture-doc",
  ]);
  assert.equal(
    rewritten.content.toString(),
    "# @cssearth/astronomy\n\nbehind [cssEarth](https://github.com/layoutit/cssEarth).\n" +
      "`formats/catalog.py` of the external catalogue pipeline (not part of this repository)\n" +
      'See "The frame tree is the whole point" in `AGENTS.md` for why that matters across 26 orders.\n' +
      "The Python writer lives in the external catalogue pipeline (not part of this repository); `pnpm check:parity` proves it.\n",
  );

  const agents = Buffer.from("# @galaxio/catalog — operator notes\n\nThe container. `CLAUDE.md` is a symlink to this file.\n");
  const notes = applyIdentityRules("AGENTS.md", agents);
  assert.deepEqual(notes.applied, ["prose-package-name", "prose-claude-symlink"]);
  assert.equal(notes.content.toString(), "# @cssearth/catalog — operator notes\n\nThe container.\n");
  assert.deepEqual(applyIdentityRules("README.md", agents).applied, ["prose-package-name"], "only AGENTS.md drops the symlink sentence");

  const manifest = Buffer.from(
    '{\n  "name": "@galaxio/catalog",\n  "repository": { "url": "https://github.com/apresmoi/galaxio.git" },\n' +
      '  "bugs": { "url": "https://github.com/apresmoi/galaxio/issues" },\n  "homepage": "https://github.com/apresmoi/galaxio#readme"\n}\n',
  );
  const renamed = applyIdentityRules("package.json", manifest);
  assert.deepEqual(renamed.applied, ["package-name", "package-urls"]);
  assert.deepEqual(JSON.parse(renamed.content.toString()), {
    name: "@cssearth/catalog",
    repository: { url: "https://github.com/layoutit/cssEarth.git" },
    bugs: { url: "https://github.com/layoutit/cssEarth/issues" },
    homepage: "https://github.com/layoutit/cssEarth#readme",
  });

  const code = Buffer.from(
    "const PROJECT_SOURCE_URL = 'https://github.com/apresmoi/galaxio/blob/main/ARCHITECTURE.md'\n" +
      "    'Galaxio reference-frame convention',\n        'Galaxio solar-system frame definition',\n" +
      "// @galaxio/astronomy\nconst galaxio = 1\n",
  );
  const model = applyIdentityRules("src/modelAccuracy.ts", code);
  assert.deepEqual(model.applied, CODE_RULES);
  assert.equal(
    model.content.toString(),
    "const PROJECT_SOURCE_URL = 'https://github.com/layoutit/cssEarth/blob/main/packages/astronomy/AGENTS.md'\n" +
      "    'cssEarth reference-frame convention',\n        'cssEarth solar-system frame definition',\n" +
      "// @galaxio/astronomy\nconst galaxio = 1\n",
    "only the three string literals change; comments and identifiers are not the rules' business",
  );
  for (const path of ["src/frames.ts", "src/index.ts", "scripts/gen_fixture.py", "tools/lib/sources.mjs"]) {
    const untouched = applyIdentityRules(path, code);
    assert.deepEqual(untouched.applied, []);
    assert.equal(untouched.content, code);
  }
});

const catalogs = targetFor("catalogs");

test("data/catalogs: exactly the vendored catalogues are present, each readable as .gxct", async () => {
  const provenance = requireCatalogProvenance(await readProvenance(catalogs));
  assert.deepEqual(Object.keys(provenance.catalogs).sort(), Object.keys(VENDORED_CATALOGS).sort());
  for (const [name, record] of Object.entries(provenance.catalogs)) {
    assert.equal(record.key, `catalogs/${name}`);
    assert.ok(record.current in provenance.files, `${record.current} is vendored`);
    assert.equal(record.currentSha256, provenance.files[record.current].sha256);
    assert.equal(record.builder, VENDORED_CATALOG_BUILDERS[name]);
    assert.equal(provenance.files[record.current].bytes, record.manifestEntry.bytes);
    for (const superseded of record.supersededVersions) {
      assert.ok(superseded in provenance.files, `${superseded} is vendored`);
    }
    const bytes = await readFile(join(catalogs.dest, record.current));
    assert.equal(bytes.readUInt32LE(0), 0x54435847, `${name} starts with the GXCT magic`);
    assert.equal(bytes.readUInt32LE(4), 1, `${name} is format version 1`);
    const headerLength = bytes.readUInt32LE(8);
    const header = requireRecord(JSON.parse(bytes.subarray(16, 16 + headerLength).toString("utf8")), `${name} GXCT header`);
    const headerMeta = requireRecord(header.meta, `${name} GXCT header.meta`);
    assert.equal(requireFiniteNumber(header.count, `${name} GXCT header.count`), record.manifestEntry.extra.count, `${name} row count matches its manifest entry`);
    assert.equal(requireString(headerMeta.source, `${name} GXCT header.meta.source`), record.manifestEntry.source);
    assert.equal(requireString(headerMeta.built, `${name} GXCT header.meta.built`), record.manifestEntry.built);
  }
  for (const path of Object.keys(provenance.files)) {
    assert.match(path, /\.gxct$/, `${path} is catalogue data`);
    assert.ok(Object.keys(VENDORED_CATALOGS).includes(path.split("/")[0]));
  }
});

test("data/catalogs: manifest.json is the vendored subset of galaxio's data manifest", async () => {
  const provenance = requireCatalogProvenance(await readProvenance(catalogs));
  const manifest = requireRecord(JSON.parse(await readFile(join(catalogs.dest, CATALOGS_MANIFEST_FILE), "utf8")), "catalog manifest");
  assert.equal(requireFiniteNumber(manifest.version, "catalog manifest.version"), provenance.upstreamManifest.version);
  assert.deepEqual(
    requireRecord(manifest.assets, "catalog manifest.assets"),
    Object.fromEntries(
      Object.entries(provenance.catalogs).map(([, record]) => [record.key, record.manifestEntry]),
    ),
  );
  for (const record of Object.values(provenance.catalogs)) {
    assert.equal(record.manifestEntry.path, `catalogs/${record.current}`);
  }
});

test("data/catalogs: provenance is honest about the data having no upstream commit", async () => {
  const provenance = requireCatalogProvenance(await readProvenance(catalogs));
  assert.equal(provenance.upstreamTracked, false);
  assert.match(provenance.upstreamTrackingNote, /gitignores data\//);
  assert.match(provenance.galaxioHeadCommit, /^[0-9a-f]{40}$/);
  assert.match(provenance.upstreamManifest.sha256, /^[0-9a-f]{64}$/);
  assert.match(provenance.transform, /^none:/);
  assert.match(provenance.licenseNote, /not MIT/);
  assert.ok(Number.isFinite(Date.parse(provenance.syncedAt)));
});

test("data/catalogs: galaxies and nebula-imagery are deliberately excluded, with reasons", async () => {
  const provenance = requireCatalogProvenance(await readProvenance(catalogs));
  assert.deepEqual(Object.keys(provenance.excluded).sort(), Object.keys(EXCLUDED_CATALOGS).sort());
  assert.match(provenance.excluded.galaxies.reason, /licensing decision/);
  const galaxiesManifest = provenance.excluded.galaxies.manifestEntry;
  assert.ok(galaxiesManifest !== null, "galaxies retains its manifest entry");
  assert.match(galaxiesManifest.license, /requires permission/);
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
  const provenance = requireCatalogProvenance(await readProvenance(catalogs));
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


test("catalog is local and astronomy source sections survive sync", () => {
  assert.ok(!TARGETS.includes("catalog"));
  assert.throws(() => targetFor("catalog"), /Unknown sync target/);
  for (const name of ["NOTICE.md", "upstream.json"]) assert.equal(existsSync(new URL(`../../packages/catalog/${name}`, import.meta.url)), false);
  assert.ok(existsSync(new URL("../../packages/catalog/LICENSE", import.meta.url)));
  const astronomy = targetFor("astronomy");
  for (const file of ["AGENTS.md", "CLAUDE.md", "tools/fetch-fixtures.mjs", "src/data/satelliteElements.data.saturn.ts", "src/__fixtures__/horizons.planetary.ts", "src/__fixtures__/horizons.asteroids-1.ts", "src/__fixtures__/horizons.asteroids-2.ts"]) {
    assert.ok(locallyMaintainedFile(astronomy, file), file);
    assert.ok(isOwnedFile(astronomy, file), file);
  }
  assert.equal(isOwnedFile(astronomy, "src/frames.ts"), false);
});

test('local fixed-epoch science inputs survive upstream refresh without being attributed to the mirrored commit', async () => {
  const astronomy = targetFor('astronomy');
  const manifest = requireRecord(JSON.parse(await readFile(join(astronomy.dest, 'source/scene-epoch/manifest.json'), 'utf8')), 'scene epoch manifest');
  const records = requireArray(manifest.records, 'scene epoch manifest.records').map((value, index) => {
    const record = requireRecord(value, `scene epoch manifest.records[${index}]`);
    return { path: requireString(record.path, `scene epoch manifest.records[${index}].path`) };
  });
  for (const file of ['tools/scene-ephemeris.mts', 'tools/acquire-scene-ephemeris.mts',
    'source/scene-epoch/README.md', 'source/scene-epoch/manifest.json',
    ...records.map(record => `source/scene-epoch/${record.path}`)]) {
    assert.ok(existsSync(join(astronomy.dest, file)), file);
    assert.ok(locallyMaintainedFile(astronomy, file), file);
    assert.ok(isOwnedFile(astronomy, file), file);
    assert.ok(!Object.hasOwn(requireFilesProvenance(await readProvenance(astronomy)).files, file), 'local source is not an upstream copy');
  }
  assert.equal(locallyMaintainedFile(astronomy, 'source/unrelated-model.txt'), false);
});


test('local companion and open-conic code stay separate from mirrored frame and VSOP math', async () => {
  const astronomy = targetFor('astronomy');
  const provenance = requirePackageProvenance(await readProvenance(astronomy));
  const mirrored = await buildManifest(astronomy);
  for (const file of ['tools/body-epoch-ephemeris.mts', 'tools/generate-scene-satellites.mts',
    'src/sceneSatellites.ts', 'src/sceneSatellites.test.ts', 'src/data/sceneSatelliteStates.data.ts',
    'src/solarSystem.ts', 'src/kepler.ts', 'src/kepler.test.ts', 'src/kepler-hyperbolic.test.ts']) {
    assert.ok(existsSync(join(astronomy.dest, file)), file);
    assert.ok(isOwnedFile(astronomy, file), `${file} survives clearVendored and upstream copy`);
    assert.ok(provenance.locallyMaintainedFiles.includes(file), `${file} has explicit local provenance`);
    assert.ok(!Object.hasOwn(mirrored, file), `${file} is excluded from mirrored-byte claims`);
    assert.ok(!Object.hasOwn(provenance.files, file), `${file} is not attributed to the upstream commit`);
  }
  for (const file of ['src/frames.ts', 'src/vsop87.ts']) {
    assert.equal(isOwnedFile(astronomy, file), false, file);
    assert.ok(Object.hasOwn(mirrored, file), `${file} retains exact-copy protection`);
  }
  assert.equal(isOwnedFile(astronomy, 'src/sceneUnrelated.ts'), false, 'no broad scene-prefix exemption');
  assert.equal(isOwnedFile(astronomy, 'tools/unrelated-ephemeris.mjs'), false, 'no broad tools exemption');
  const solarSystemOrigin = requireRecord(provenance.locallyMaintainedOrigins['src/solarSystem.ts'], 'package provenance.locallyMaintainedOrigins.src/solarSystem.ts');
  assert.match(requireString(solarSystemOrigin.lastMirroredSha256, 'package provenance.locallyMaintainedOrigins.src/solarSystem.ts.lastMirroredSha256'), /^[0-9a-f]{64}$/);
});


test('upstream refresh preserves each renamed TypeScript owner and its historical JavaScript name', () => {
  const astronomy=targetFor('astronomy');
  for (const file of ['tools/scene-ephemeris','tools/acquire-scene-ephemeris','tools/body-epoch-ephemeris',
    'tools/generate-scene-satellites','tools/lib/fit-position-correction','tools/lib/fit-harmonics',
    'tools/generate-dwarf-planets','tools/generate-series','tools/lib/elp2000','tools/lib/horizons','tools/lib/sources','tools/lib/vsop87']) {
    for (const extension of ['.mjs','.mts']) assert.equal(isOwnedFile(astronomy,file+extension),true,file+extension);
  }
  assert.equal(isOwnedFile(astronomy,'tools/unrelated-ephemeris.mts'),false);
});
