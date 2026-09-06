import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PreparedLeaf } from '../scene/projector.js';
import type { PreparedTree } from '../../rendering/prepared-presentation.js';
import type { ObjectControls } from '../../runtime/object-contract.js';
import type { PreparedMaterialTrack } from '../../rendering/prepared-material.js';
import type { PresentationDraft } from './types.js';

export interface PreparedNode { style: CSSStyleDeclaration; }
export interface NodeBuilder {
  element(tag: string, className?: string | null, style?: string, attributes?: Record<string, string>): PreparedNode;
  mesh(className: string, style?: string, attributes?: Record<string, string>): PreparedNode;
  append(parent: PreparedNode | null, ...nodes: PreparedNode[]): void;
  leaf(leaf: PreparedLeaf): PreparedNode;
  finish(roots: {camera: PreparedNode; scene: PreparedNode}): {tree: PreparedTree; index(node: PreparedNode): number};
}
interface Adapters {
  createPreparedNodeTree(options: {cssomReads: Map<string, Record<string, string>>}): NodeBuilder;
  prepareCssomDeclarationReads(styles: string[]): Promise<Map<string, Record<string, string>>>;
  prepareCatalogueStars(options: {fovDegrees: number}): Promise<unknown>;
  prepareSolarSystemPresentation(options: Record<string, unknown>): PresentationDraft['heliocentricView'];
  prepareMaterialTracks(plan: PresentationDraft): PreparedMaterialTrack[];
  requirePreparedPresentation(plan: unknown, options: {controls: ObjectControls}): void;
  navigationMarkers: unknown;
}
function fn<T>(module: Record<string, unknown>, name: string): T {
  if (typeof module[name] !== 'function') throw new TypeError(`Missing preparation adapter: ${name}`);
  return module[name] as T;
}
/** Existing shared science/CSSOM helpers remain offline, outside the runtime closure. */
export async function loadPresentationAdapters(): Promise<Adapters> {
  const load = async (file: string): Promise<Record<string, unknown>> => import(pathToFileURL(resolve(file)).href);
  const [tree, cssom, catalogue, solar, materials, contract, markers] = await Promise.all([
    load('tools/prepared-node-tree.mjs'), load('tools/prepared-cssom.mjs'),
    load('src/platform/prepare-catalogue-stars.mjs'), load('tools/objects/solar-system-presentation.mjs'),
    load('tools/prepare-materials.mjs'), load('src/platform/prepared-presentation-contract.mjs'),
    load('site/prepared-navigation-markers.mjs'),
  ]);
  return {
    createPreparedNodeTree: fn(tree, 'createPreparedNodeTree'), prepareCssomDeclarationReads: fn(cssom, 'prepareCssomDeclarationReads'),
    prepareCatalogueStars: fn(catalogue, 'prepareCatalogueStars'), prepareSolarSystemPresentation: fn(solar, 'prepareSolarSystemPresentation'),
    prepareMaterialTracks: fn(materials, 'prepareMaterialTracks'), requirePreparedPresentation: fn(contract, 'requirePreparedPresentation'),
    navigationMarkers: markers.PREPARED_NAVIGATION_MARKERS,
  };
}
export type PresentationAdapters = Awaited<ReturnType<typeof loadPresentationAdapters>>;
