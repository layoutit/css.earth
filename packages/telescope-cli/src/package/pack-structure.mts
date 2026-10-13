/** Structural guards shared by offline unit tests and the maintainer's real pack verification. */
import assert from 'node:assert/strict';
import { requireRecord } from '@cssearth/core';

export function assertPackedClosure(files: readonly string[]) {
  for(const path of files) {
    // Forbidden contents are rejected everywhere, including otherwise allowed archive descendants.
    assert.doesNotMatch(path, /(?:^|\/)(?:pnpm-lock\.yaml|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|bun\.lockb?|composer\.lock|Cargo\.lock|Pipfile\.lock|poetry\.lock|uv\.lock|evidence|tests?|__tests__|fixtures?)(?:\/|$)|(?:^|\/)src\/objects(?:\/|$)|(?:^|\/)(?:test_[^/]*|[^/]*\.(?:test|spec)\.[^/]+)$/u, path);
    assert.match(path, /^package\/(?:package\.json|README\.md|LICENSE|run-typed-module\.mjs|skills\/telescope\/SKILL\.md|\.(?:claude|codex|factory)-plugin\/plugin\.json|dist\/(?:(?:cli|telescope)\.mjs|(?:sphere|viewer)-lane\.(?:js|cjs|d\.ts|d\.cts))|data\/.+)$/u, path);
    if(!path.startsWith('package/data/'))continue;
    // Generated viewer inputs have explicit readers; archive programs/ledgers/toolchains are selected dynamically.
    assert.match(path,/^package\/data\/(?:spheres\/sphere-bank\.json\.gz|renderer\/volume\.css|(?:target-catalogue|site-targets)\.json|telescope-core\/package\.json|telescope-core\/toolchains\/.+|cli\/src\/(?:archives\/.+|examples\.json|modes\.json)|src\/sources\/(?:wwt\/(?:core-imagesets\.jsonl|fits-associations\.json|phat-fits\.json|WWT-CORE-CATALOGS-LICENSE\.txt)|[^/]+\/(?:ledger\.json|discovery\.json|target-associations\.json)))$/u,path);
  }
}
export function assertPackedExports(manifest: Readonly<Record<string, unknown>>, files: readonly string[]): void {
  const visit = (value: unknown): void => {
    if (typeof value === 'string') { assert.ok(files.includes('package/' + value.replace(/^\.\//u, '')), `Missing packed export: ${value}`); return; }
    for (const child of Object.values(requireRecord(value))) visit(child);
  };
  visit(manifest.exports);
  for (const value of Object.values(requireRecord(manifest.bin))) visit(value);
}
