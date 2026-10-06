/** No exceptions: bake must not declare renderer in any dependency field. Resolved imports use the existing graph. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { declaredPackage } from './declared-dependencies.mts';
import { PREPARATION_RENDERER_EXCEPTIONS, type RendererException } from './preparation-without-renderer.mts';

export function bakeRendererFindings(manifest: unknown, exceptions: readonly RendererException[] = PREPARATION_RENDERER_EXCEPTIONS): string[] {
  const path = 'packages/bake/package.json';
  return [
    ...(declaredPackage(path, manifest).declared.has('@cssearth/renderer') ? [`${path}: bake must not declare renderer in any dependency field`] : []),
    ...exceptions.filter(entry => entry.path.startsWith('packages/bake/')).map(entry => `${entry.path}: bake permits no renderer exception`),
  ];
}

export function checkBakeWithoutRenderer(root: string): string[] {
  return bakeRendererFindings(JSON.parse(readFileSync(resolve(root, 'packages/bake/package.json'), 'utf8')));
}
