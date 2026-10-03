/** Shared prepared schema literals belong to objects; owner-internal literals need no inventory. */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { isTestPath } from './zones.mts';

export interface SchemaException { readonly schema: string; readonly owners: readonly string[]; readonly reason: string }
const SOURCE = /(?:\.[cm]?tsx?|\.py|\.astro)$/u;
const SCHEMA = /cssearth-[a-z0-9-]+@[0-9]+/gu;

/** Includes type literals, template chunks and embedded protocol scripts; excludes comments and JSON data. */
export function schemaLiterals(path: string, text: string): string[] {
  const found = new Set<string>();
  // Preserved Python and Astro sources use the cheap, exact quoted-id check.
  if (path.endsWith('.py') || path.endsWith('.astro')) {
    const source = text.replace(/^\s*#.*$/gmu, '').replace(/<!--[\s\S]*?-->/gu, '');
    return [...new Set([...source.matchAll(/(['"])(cssearth-[a-z0-9-]+@[0-9]+)\1/gu)].map(match => match[2]!))].sort();
  }
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
      for (const match of node.text.matchAll(SCHEMA)) found.add(match[0]);
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, /x$/u.test(path) ? ts.ScriptKind.TSX : ts.ScriptKind.TS));
  return [...found].sort();
}

/** One owner per workspace package, lab package, application or top-level tooling directory. */
export function schemaOwner(path: string): string {
  const parts = path.split('/');
  if (parts[0] === 'packages') return parts.slice(0, 2).join('/');
  if (parts[0] === 'labs') return parts.slice(0, parts[2] === 'packages' ? 4 : 2).join('/');
  if (path.startsWith('.github/scripts/')) return '.github/scripts';
  return parts.length === 1 ? '(repository root)' : parts[0]!;
}

function isSchemaSource(path: string): boolean {
  return SOURCE.test(path) && !isTestPath(path) && !/(^|\/)(?:prepared|dist|data)(?:\/|$)/u.test(path);
}

export interface SchemaViolation { readonly schema: string; readonly owners: readonly string[]; readonly objectsOwned: boolean }

/** Compute shared raw literals and duplicates of an objects definition, without a per-file inventory. */
export function schemaViolations(sources: ReadonlyMap<string, string>): SchemaViolation[] {
  const definitions = new Set<string>(), owners = new Map<string, Set<string>>();
  for (const [path, text] of sources) {
    if (!isSchemaSource(path)) continue;
    for (const schema of schemaLiterals(path, text)) {
      if (path.startsWith('packages/objects/src/')) { definitions.add(schema); continue; }
      const found = owners.get(schema) ?? new Set<string>();
      found.add(schemaOwner(path));
      owners.set(schema, found);
    }
  }
  return [...owners].filter(([schema, found]) => found.size > 1 || definitions.has(schema))
    .map(([schema, found]) => ({ schema, owners: [...found].sort(), objectsOwned: definitions.has(schema) }))
    .sort((a, b) => a.schema.localeCompare(b.schema, 'en'));
}

export function schemaOwnershipFindings(sources: ReadonlyMap<string, string>, exceptions: readonly SchemaException[]): string[] {
  const violations = schemaViolations(sources), findings: string[] = [];
  for (const violation of violations) {
    if (!exceptions.some(entry => entry.schema === violation.schema && entry.reason.trim()
      && JSON.stringify([...entry.owners].sort()) === JSON.stringify(violation.owners)))
      findings.push(`${violation.schema}: raw literals in ${violation.owners.join(', ')}${violation.objectsOwned ? '; duplicates objects definition' : '; shared schema belongs in packages/objects/src'}`);
  }
  for (const [index, entry] of exceptions.entries()) {
    const violation = violations.find(item => item.schema === entry.schema);
    if (!entry.reason.trim() || !violation || JSON.stringify([...entry.owners].sort()) !== JSON.stringify(violation.owners))
      findings.push(`${entry.schema}: stale or invalid schema exception (${entry.owners.join(', ')}; ${entry.reason})`);
    if (exceptions.findIndex(other => other.schema === entry.schema) !== index)
      findings.push(`${entry.schema}: duplicate schema exception`);
  }
  return findings.sort();
}

export function readSchemaExceptions(): SchemaException[] {
  const value: unknown = JSON.parse(readFileSync(new URL('./format-schema-exceptions.json', import.meta.url), 'utf8'));
  return requireArray(value, 'schema exceptions').map(item => {
    const record = requireRecord(item, 'schema exception');
    return { owners: requireArray(record.owners, 'schema exception owners').map(owner => requireString(owner)), schema: requireString(record.schema), reason: requireString(record.reason) };
  });
}

export function checkFormatSchemaOwnership(root: string, files: readonly string[]): string[] {
  const sources = new Map(files.filter(path => isSchemaSource(path) && existsSync(resolve(root, path)))
    .map(path => [path, readFileSync(resolve(root, path), 'utf8')] as const));
  return schemaOwnershipFindings(sources, readSchemaExceptions());
}
