import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { COMPILED_PAGE_STYLES } from '../server/compiled-page-styles.mts';
import { objectPageStyles } from '../contracts/object-page-contract.mts';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Read only the string export Vite emitted; never evaluate compiled JavaScript. */
export function compiledStyleExport(program: unknown): string {
  if (!record(program) || !Array.isArray(program.body)) throw new TypeError('Invalid compiled stylesheet module.');
  const names = new Map<string, string>();
  let exported: string | undefined;
  for (const statement of program.body) {
    if (!record(statement)) throw new TypeError('Invalid stylesheet statement.');
    if (statement.type === 'VariableDeclaration' && Array.isArray(statement.declarations)) {
      for (const declaration of statement.declarations) {
        if (!record(declaration) || !record(declaration.id) || !record(declaration.init) ||
            typeof declaration.id.name !== 'string' || typeof declaration.init.value !== 'string') throw new TypeError('Stylesheet output must contain literal strings.');
        names.set(declaration.id.name, declaration.init.value);
      }
    } else if (statement.type === 'ExportNamedDeclaration' && Array.isArray(statement.specifiers)) {
      for (const specifier of statement.specifiers) {
        if (!record(specifier) || !record(specifier.exported) || !record(specifier.local) || specifier.exported.name !== 'default' || typeof specifier.local.name !== 'string') throw new TypeError('Unexpected stylesheet export.');
        exported = names.get(specifier.local.name);
      }
    } else if (statement.type === 'ExportDefaultDeclaration' && record(statement.declaration)) {
      exported = typeof statement.declaration.value === 'string' ? statement.declaration.value
        : typeof statement.declaration.name === 'string' ? names.get(statement.declaration.name) : undefined;
    } else throw new TypeError('Stylesheet output must be a standalone literal module.');
  }
  if (exported === undefined) throw new TypeError('Stylesheet output has no default string.');
  return exported;
}

/** Independent prerender entries preserve Vite's complete CSS pipeline without making every page import every sheet. */
export function staticPageStyles(root: string, enabled: boolean): Plugin[] {
  const entries = new Map<string, string>();
  const references = new Map<string, string>();
  const applies = (environment: { name: string }) => enabled && environment.name === 'prerender';
  return [{
    name: 'cssearth-static-page-style-reader', apply: 'build', enforce: 'pre',
    applyToEnvironment: applies,
    async resolveId(source, importer, options) {
      if (!source.endsWith('/page-styles.mts')) return;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      if (resolved?.id === resolve(root, 'site/components/page-styles.mts')) return resolve(root, 'site/server/built-page-styles.mts');
    },
  }, {
    name: 'cssearth-static-page-styles', apply: 'build', enforce: 'post',
    applyToEnvironment: applies,
    async buildStart() {
      entries.clear();
      references.clear();
      for (const object of await readdir(resolve(root, 'src/objects'), { withFileTypes: true })) {
        if (!object.isDirectory()) continue;
        const text = await readFile(resolve(root, 'src/objects', object.name, 'object.json'), 'utf8').catch((error: unknown) => {
          if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined;
          throw error;
        });
        if (text === undefined) continue; // Planned, README-only packages have no prepared page descriptor.
        const descriptor: unknown = JSON.parse(text);
        const properties = record(descriptor) && record(descriptor.properties) ? descriptor.properties : undefined;
        if (!properties || !record(properties.page) || properties.page.stylesheets === undefined) continue;
        for (const path of objectPageStyles(descriptor)) entries.set(`${resolve(root, path)}?inline`, path);
      }
      for (const [id, path] of entries) references.set(this.emitFile({ type: 'chunk', id, preserveSignature: 'strict' }), path);
    },
    async generateBundle(_options, bundle) {
      const styles: Record<string, string> = {};
      for (const [reference, path] of references) {
        const file = this.getFileName(reference), chunk = bundle[file];
        if (!chunk || chunk.type !== 'chunk') throw new Error(`Missing finished stylesheet chunk: ${path}`);
        styles[path] = compiledStyleExport(this.parse(chunk.code));
        // Astro's manifest discovers these chunks' relative assets before removing the private prerender bundle.
      }
      if (Object.keys(styles).length !== entries.size) throw new Error('Missing finished Vite page stylesheet exports.');
      const output = resolve(root, COMPILED_PAGE_STYLES);
      await mkdir(dirname(output), { recursive: true });
      await writeFile(output, JSON.stringify(Object.fromEntries(Object.entries(styles).sort(([a], [b]) => a.localeCompare(b, 'en')))));
      this.info(`Prepared ${entries.size} private stylesheet transports (${relative(root, output)}).`);
    },
  }];
}
