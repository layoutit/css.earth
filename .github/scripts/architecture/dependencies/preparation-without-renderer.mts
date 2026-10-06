/** Preparation reads objects contracts; only named runtime publication/transport consumers may reach renderer. */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import ts from 'typescript';
import { importedSpecifiers } from './declared-dependencies.mts';

export interface RendererException { readonly path: string; readonly reason: string }
export const PREPARATION_RENDERER_EXCEPTIONS: readonly RendererException[] = [
  { path: 'packages/telescope-cli/package.json', reason: 'Declares renderer for the four named runtime transport/publication consumers.' },
  { path: 'packages/telescope-cli/src/implementation-dependencies.mts', reason: 'Reads the declared renderer build config input to follow its entry sources; never runs renderer here.' },
  { path: 'packages/telescope-cli/src/delivery/spatial-handoff.mts', reason: 'Runs application loaders, including compressed binary point banks, for physical resource handoff.' },
  { path: 'packages/telescope-cli/src/sphere/native-scroll/native-camera.mts', reason: 'Reads retained renderer variants and camera transforms for native CSS publication.' },
  { path: 'packages/telescope-cli/src/sphere/sphere-html.mts', reason: 'Serializes and publishes retained renderer scenes into sphere HTML.' },
  { path: 'packages/telescope-cli/src/sphere/sphere-oracle.mts', reason: 'Runs the world-context renderer to generate oracle scenes.' },
];
const PREPARATION = /^packages\/(?:bake|telescope-cli)\//u;
const SOURCE = /\.[cm]?[jt]sx?$/u;
const renderer = (specifier: string, path: string) => /^@cssearth\/renderer(?:\/|$)/u.test(specifier)
  || specifier.startsWith('packages/renderer/')
  || specifier.startsWith('.') && posix.normalize(posix.join(dirname(path), specifier)).startsWith('packages/renderer/');

const targets = (value: unknown): string[] => typeof value === 'string' ? [value] : Array.isArray(value) ? value.flatMap(targets)
  : value !== null && typeof value === 'object' ? Object.values(value).flatMap(targets) : [];

/** Source literals also cover renderer entry URLs handed to esbuild instead of imported directly. */
export function rendererUses(path: string, text: string): boolean {
  if (path.endsWith('/package.json')) {
    const manifest = requireRecord(JSON.parse(text), path);
    return targets(manifest.imports).some(value => renderer(value, path))
      || ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'].some(field =>
      manifest[field] !== undefined && Object.hasOwn(requireRecord(manifest[field], `${path} ${field}`), '@cssearth/renderer'));
  }
  if (/\/tsconfig[^/]*\.json$/u.test(path)) {
    const config = requireRecord(JSON.parse(text), path);
    if ([...targets(config.extends), ...targets(config.compilerOptions)].some(value => renderer(value, path))) return true;
    if (config.references === undefined) return false;
    if (!Array.isArray(config.references)) throw new TypeError(`${path} references must be an array.`);
    return config.references.some(reference => {
      const value = requireRecord(reference, `${path} reference`).path;
      return typeof value === 'string' && (posix.normalize(posix.join(dirname(path), value)) === 'packages/renderer'
        || posix.normalize(posix.join(dirname(path), value)).startsWith('packages/renderer/'));
    });
  }
  if (!SOURCE.test(path)) return false;
  let urlUse = false;
  const visit = (node: ts.Node): void => {
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'URL'
      && node.arguments?.[0] && ts.isStringLiteralLike(node.arguments[0])
      && SOURCE.test(node.arguments[0].text) && node.arguments[1]?.getText() === 'import.meta.url' && renderer(node.arguments[0].text, path)) urlUse = true;
    ts.forEachChild(node, visit);
  };
  visit(ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true));
  return urlUse || importedSpecifiers(text, path).some(specifier => renderer(specifier, path))
    || [...text.matchAll(/['"]([^'"\n]*packages\/renderer\/(?:src\/[^'"\n]+|tsup\.config\.ts))['"]/gu)].some(match => renderer(match[1]!, path));
}

export function preparationRendererFindings(sources: ReadonlyMap<string, string>,
  exceptions: readonly RendererException[] = PREPARATION_RENDERER_EXCEPTIONS): string[] {
  const allowed = new Map(exceptions.map(entry => [entry.path, entry.reason]));
  const used = new Set([...sources].filter(([path, text]) => PREPARATION.test(path) && rendererUses(path, text)).map(([path]) => path));
  return [
    ...[...used].filter(path => !allowed.has(path)).map(path => `${path}: preparation must not depend on renderer; use objects contracts or name the runtime consumer`),
    ...exceptions.filter(entry => !entry.reason.trim() || !PREPARATION.test(entry.path) || !used.has(entry.path))
      .map(entry => `${entry.path}: stale or invalid renderer exception (${entry.reason})`),
  ].sort();
}

export function checkPreparationWithoutRenderer(root: string, files: readonly string[]): string[] {
  const paths = files.filter(path => PREPARATION.test(path) && existsSync(resolve(root, path)) && (SOURCE.test(path) || path.endsWith('/package.json') || /\/tsconfig[^/]*\.json$/u.test(path)));
  return preparationRendererFindings(new Map(paths.map(path => [path, readFileSync(resolve(root, path), 'utf8')])));
}
