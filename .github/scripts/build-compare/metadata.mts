/** Read-only Rollup observation; metadata lives outside emitted production files. */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { record } from './records.mts';

export function comparisonMapSetting(name: string, sourcemap: boolean | 'inline' | 'hidden' | undefined, worker = false): { build: { sourcemap: 'hidden' } } | undefined {
  if (!(name === 'client' || worker) || sourcemap) return undefined;
  return { build: { sourcemap: 'hidden' } };
}

export function comparisonMetadata(root: string, output: string, worker = false, mapPolicy = { addedClientMaps: false }): Plugin {
  let sequence = 0;
  const rendered = new Map<string, string>();
  const addedMapEnvironments = new Set<string>();
  const id = (value: string): string => value.split(root).join('<root>').replace(/^<root>\//u, '').replace(/\\/gu, '/');
  const sourceName = (value: string): string => isAbsolute(value) ? relative(root, value).replace(/\\/gu, '/') : value;
  const set = (value: unknown): string[] => value instanceof Set ? [...value].map(value => { if (typeof value !== 'string') throw new Error('Non-string Vite metadata'); return value; }).sort() : [];
  return {
    name: 'cssearth-build-comparison-metadata', apply: 'build', enforce: 'pre',
    configEnvironment(name, config) {
      const setting = comparisonMapSetting(name, config.build?.sourcemap, worker);
      if (setting) { addedMapEnvironments.add(name); if (name === 'client' && !worker) mapPolicy.addedClientMaps = true; }
      return setting;
    },
    renderChunk(code, chunk) { rendered.set(chunk.fileName, id(code)); return null; },
    async generateBundle(_options, bundle) {
      const environment = worker ? `worker:${Object.values(bundle).flatMap(chunk => chunk.type === 'chunk' && chunk.isEntry && chunk.facadeModuleId ? [id(chunk.facadeModuleId)] : []).sort().join('|')}` : `${this.environment?.name ?? 'ssr'}-${sequence++}`;
      const references: Record<string, string> = {};
      const chunks = Object.values(bundle).flatMap(chunk => {
        if (chunk.type !== 'chunk') return [];
        const metadata = chunk.viteMetadata;
        const modules = Object.entries(chunk.modules).map(([moduleId, module]) => {
          const info = this.getModuleInfo(moduleId);
          // Rolldown injects this self-contained helper after module resolution: it has no ModuleInfo.
          if (!info && moduleId !== '\0rolldown/runtime.js') throw new Error(`Missing module info: ${moduleId}`);
          if (!info && (!module.code || /\b(?:import|export)\s/u.test(module.code))) throw new Error('Unexpected generated runtime graph');
          const produced: string[] = [];
          for (const match of (module.code ?? '').matchAll(/__VITE_ASSET__([\w$]+)__(?:\$_(.*?)__)?/gu)) {
            const file = this.getFileName(match[1]!);
            references[match[0]] = file + (match[2] ?? '');
            produced.push(file);
          }
          const meta = info?.meta.viteMetadata === undefined ? {} : record(info.meta.viteMetadata);
          return { id: id(moduleId), code: module.code === null ? null : id(module.code), renderedLength: module.renderedLength, originalLength: module.originalLength ?? info?.code?.length ?? module.renderedLength,
            codeDigest: createHash('md5').update(module.code === null ? '<null>' : id(module.code)).digest('hex'),
            importedIds: (info?.importedIds ?? []).map(id), dynamicallyImportedIds: (info?.dynamicallyImportedIds ?? []).map(id), importers: (info?.importers ?? []).map(id).sort(),
            importedCss: set(meta.importedCss), importedAssets: [...new Set([...set(meta.importedAssets), ...produced])].sort() };
        });
        return [{ rawCode: modules.every(module => !module.code || (rendered.get(chunk.fileName) ?? id(chunk.code)).includes(module.code)) ? (rendered.get(chunk.fileName) ?? id(chunk.code)) : undefined, emittedDigest: createHash('md5').update(chunk.code).digest('hex'), fileName: chunk.fileName, name: chunk.name, isEntry: chunk.isEntry, isDynamicEntry: chunk.isDynamicEntry,
          facadeModuleId: chunk.facadeModuleId === null ? null : id(chunk.facadeModuleId), imports: chunk.imports, dynamicImports: chunk.dynamicImports,
          modules, importedCss: set(metadata?.importedCss), importedAssets: set(metadata?.importedAssets) }];
      });
      const assets = Object.values(bundle).flatMap(asset => asset.type === 'asset' && !asset.fileName.endsWith('.map') ? [{ fileName: asset.fileName, names: asset.names, originalFileNames: asset.originalFileNames.map(sourceName) }] : []);
      await mkdir(output, { recursive: true });
      // A worker plugin instance may be created for each entry; facade ids make its record name unique.
      const identity = createHash('md5').update(JSON.stringify(chunks.map(c => c.facadeModuleId))).digest('hex');
      const pinned = process.env.CSSEARTH_COMPARISON_VERSION;
      if (!pinned) throw new Error('Missing pinned version evidence input');
      const versionFiles = Object.values(bundle).flatMap(chunk => chunk.type === 'chunk' && chunk.code.includes(JSON.stringify(pinned)) ? [chunk.fileName] : []);
      await writeFile(resolve(output, `${worker ? 'worker' : environment}-${identity}.json`), JSON.stringify({ environment, chunks, assets, versionFiles, references, addedMaps: (addedMapEnvironments.has(this.environment?.name ?? 'ssr') || worker && mapPolicy.addedClientMaps) ? Object.values(bundle).flatMap(asset => asset.type === 'asset' && asset.fileName.endsWith('.map') ? [asset.fileName] : []) : [] }));
    },
  };
}
