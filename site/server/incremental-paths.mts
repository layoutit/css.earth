import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { readPreparedRuntimeText } from '@cssearth/objects/node';
import { objectPageCss } from '@cssearth/objects';
import { incrementalBuildEnabled } from '../contracts/build-metadata.mts';
import { worldBillboardInputs } from '../server-assets/world-billboard-inputs.mts';
import { sceneCssInputs } from '../server-assets/asset-origin.mts';
import { objectPageStyles, SHELL_STYLE_FILE } from '../contracts/object-page-contract.mts';

interface StaticPath {
  readonly params: Readonly<Record<string, string | number | undefined>>;
  readonly props?: Readonly<Record<string, unknown>>;
}
interface Input { readonly path: string; readonly object: string }
interface OwnerInputs { readonly identity: string; readonly references: readonly string[] }
const ID = /^[a-z0-9][a-z0-9_.+-]*$/u;
const missing = (error: unknown): boolean => error instanceof Error && 'code' in error && error.code === 'ENOENT';
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

function decodedReferences(document: unknown, references: Set<string>): void {
  function visit(value: unknown): void {
    if (typeof value === 'string') {
      for (const match of value.matchAll(/(?:\/scenes\/|src\/objects\/)([a-z0-9][a-z0-9_.+-]*)\//gu)) references.add(match[1]!);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value !== null && typeof value === 'object') {
      for (const [field, item] of Object.entries(value)) {
        if (field === 'objectId' && typeof item === 'string' && ID.test(item)) references.add(item);
        visit(item);
      }
    }
  }
  visit(document);
}

/** Git's blob identity, including its type/length header. No new content-address namespace is introduced. */
export function gitBlobIdentity(bytes: Uint8Array): string {
  return createHash('sha1').update(`blob ${bytes.byteLength}\0`).update(bytes).digest('hex');
}

/** A fresh instance owns one build's immutable input snapshot; tests create a new one after changing inputs. */
export class IncrementalPathInputs {
  readonly #root: string;
  readonly #environment: string;
  readonly #owners = new Map<string, Promise<OwnerInputs>>();
  #global: Promise<string> | undefined;

  constructor(root: string, env: NodeJS.ProcessEnv = process.env) {
    this.#root = resolve(root);
    this.#environment = JSON.stringify([env.ASSET_ORIGIN?.trim() ?? '', env.CSSEARTH_ALLOW_MISSING_ASSETS ?? '']);
  }

  async #tree(path: string, references?: Set<string>): Promise<Input[]> {
    let entries;
    try { entries = await readdir(join(this.#root, path), { withFileTypes: true }); }
    catch (error) { if (missing(error)) return [{ path, object: 'absent' }]; throw error; }
    const result: Input[] = [{ path, object: 'directory' }];
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const child = `${path}/${entry.name}`;
      if (entry.isDirectory()) result.push(...await this.#tree(child, references));
      else if (entry.isFile()) result.push(await this.#file(child, references));
      else throw new TypeError(`Incremental input must be a regular file or directory: ${child}`);
    }
    return result;
  }

  async #file(path: string, references?: Set<string>): Promise<Input> {
    let bytes: Buffer;
    try { bytes = await readFile(join(this.#root, path)); }
    catch (error) { if (missing(error)) return { path, object: 'absent' }; throw error; }
    if (references && path.endsWith('.json')) {
      // A scene can draw another owner's bank or name its public image. Those bytes belong in its input closure.
      const logicalText = path.endsWith('/prepared/runtime.json')
        ? await readPreparedRuntimeText(dirname(join(this.#root, path))) : bytes.toString('utf8');
      const document: unknown = JSON.parse(logicalText);
      decodedReferences(document, references);
      if (/\/prepared\/(?:members|world)\.json$/u.test(path)) {
        for (const input of worldBillboardInputs(document)?.inputs ?? []) if (input.owner) references.add(input.owner);
      }
    }
    return { path, object: gitBlobIdentity(bytes) };
  }

  #owner(id: string): Promise<OwnerInputs> {
    if (!ID.test(id)) throw new TypeError(`Invalid incremental object identity: ${id}`);
    let known = this.#owners.get(id);
    if (!known) {
      known = (async () => {
        const base = `src/objects/${id}`, references = new Set<string>();
        const inputs = (await Promise.all([
          ...['object.json', 'inventory.json', 'README.md', 'text.json'].map(file => this.#file(`${base}/${file}`, references)),
          ...['prepared', 'source/content', 'source/presentation', 'source/preparation'].map(directory => this.#tree(`${base}/${directory}`, references)),
          this.#tree(`site/public/scenes/${id}`),
          this.#file(`site/public/social/${id}.jpg`),
        ])).flat();
        inputs.push(...await this.#styles(id));
        inputs.sort((a, b) => a.path.localeCompare(b.path, 'en'));
        return { identity: gitBlobIdentity(Buffer.from(JSON.stringify(inputs))), references: [...references].sort() };
      })();
      this.#owners.set(id, known);
    }
    return known;
  }

  async #styles(id: string): Promise<Input[]> {
    let descriptor: unknown;
    try { descriptor = JSON.parse(await readFile(join(this.#root, 'src/objects', id, 'object.json'), 'utf8')); }
    catch (error) { if (missing(error)) return []; throw error; }
    const properties = record(descriptor) && record(descriptor.properties) ? descriptor.properties : undefined;
    const page = properties && record(properties.page) ? properties.page : undefined;
    // Context banks have no page styles; scene owners use the same validated cascade and substitution as ObjectPage.
    if (page?.stylesheets === undefined) return [];
    const inputs: Input[] = [], inventories = new Set<string>();
    for (const path of objectPageStyles(descriptor)) {
      const bytes = await readFile(join(this.#root, path));
      inputs.push({ path, object: gitBlobIdentity(bytes) });
      const css = path === SHELL_STYLE_FILE ? bytes.toString('utf8') : objectPageCss(bytes.toString('utf8'), id);
      for (const { owner } of sceneCssInputs(css)) inventories.add(owner);
    }
    // CSS rewrites consume inventories, not the other owner's runtime or unrelated authoring inputs.
    for (const owner of [...inventories].sort()) inputs.push(await this.#file(`src/objects/${owner}/inventory.json`));
    return inputs;
  }

  #shared(): Promise<string> {
    return this.#global ??= (async () => {
      // Native module tracking covers imported modules, but not filesystem readers, external workspace bundles,
      // or function-valued config plugins. Capture those inputs explicitly, including missing directories.
      const inputs = (await Promise.all([
        this.#file('site/astro.config.mts'), this.#file('site/source/source-icons.json'), this.#file('site/public/social/earth.jpg'),
        this.#tree('site/build'), this.#tree('site/prepared'),
      ])).flat();
      let packages: string[] = [];
      try { packages = (await readdir(join(this.#root, 'packages'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name); }
      catch (error) { if (!missing(error)) throw error; }
      for (const name of packages.sort()) inputs.push(...await this.#tree(`packages/${name}/dist`));
      let objects: string[] = [];
      try { objects = (await readdir(join(this.#root, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name); }
      catch (error) { if (!missing(error)) throw error; }
      for (const id of objects.sort()) {
        for (const name of ['members.json', 'places.json', 'world.json', 'world-index.json', 'world-context.json']) {
          inputs.push(await this.#file(`src/objects/${id}/prepared/${name}`));
        }
        inputs.push(...await this.#tree(`src/objects/${id}/prepared/views`));
      }
      inputs.sort((a, b) => a.path.localeCompare(b.path, 'en'));
      return gitBlobIdentity(Buffer.from(JSON.stringify(inputs)));
    })();
  }

  async key(path: StaticPath, extraOwners: readonly string[] = []): Promise<string> {
    const owner = path.params.id;
    if (typeof owner !== 'string' || !ID.test(owner)) throw new TypeError('Incremental paths need an object id.');
    const scene = path.props?.sceneId;
    if (scene !== undefined && (typeof scene !== 'string' || !ID.test(scene))) throw new TypeError('Invalid incremental scene identity.');
    const seen = new Set<string>(), pending = [owner, ...(typeof scene === 'string' ? [scene] : []), ...extraOwners];
    const inputs: Array<readonly [string, string]> = [];
    for (const id of pending) {
      if (seen.has(id)) continue;
      seen.add(id);
      const current = await this.#owner(id);
      inputs.push([id, current.identity]);
      pending.push(...current.references.filter(reference => !seen.has(reference)));
    }
    inputs.sort(([a], [b]) => a.localeCompare(b, 'en'));
    return gitBlobIdentity(Buffer.from(JSON.stringify([this.#environment, await this.#shared(), path.params, path.props ?? {}, inputs])));
  }
}

let current: IncrementalPathInputs | undefined;

/** Default builds return precisely their existing paths and perform no snapshot work. */
export async function incrementalPaths<Path extends StaticPath>(paths: Path[], owners: (path: Path) => readonly string[] = () => []): Promise<Array<Path & { cacheKey?: string }>> {
  if (!incrementalBuildEnabled()) return paths;
  current ??= new IncrementalPathInputs(process.cwd());
  // Owner reads are memoized; serial keys avoid flooding file handles on the full world's route set.
  const result: Array<Path & { cacheKey?: string }> = [];
  const started = performance.now();
  for (const path of paths) result.push({ ...path, cacheKey: await current.key(path, owners(path)) });
  console.info(`[incremental] Prepared ${result.length} route keys in ${((performance.now() - started) / 1000).toFixed(3)}s.`);
  return result;
}
