// Records what one preparation process reads, probes, lists and writes, and which programs it starts, so the
// preparation cache keys a body's outputs on exactly those files. tools/prepare/prepare-objects.mts loads it into each
// body's preparation through NODE_OPTIONS=--import, so Node child processes inherit it. Each process writes
// <directory>/<pid>.started when it begins and <pid>.json when it exits; the cache refuses a receipt when a
// started process left no record.
import childProcess from 'node:child_process';
import fs from 'node:fs';
import { createRequire, registerHooks, syncBuiltinESMExports } from 'node:module';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import workerThreads from 'node:worker_threads';
import { CATALOG_MODULE, DESCRIPTOR_PATH, PREPARATION_TRACE_SCHEMA, PREPARATION_TRACE_VARIABLE, descriptorDigest,
  type PreparationAccess, type PreparationTrace, type TracedCommand, type TracedState } from './preparation-trace-format.mts';

const directory = process.env[PREPARATION_TRACE_VARIABLE];
if (!directory) throw new Error(`${PREPARATION_TRACE_VARIABLE} must name the preparation trace directory.`);
const traceDirectory = resolve(directory), importFlag = `--import=${import.meta.url}`;
const original = { statSync: fs.statSync, readFileSync: fs.readFileSync, writeFileSync: fs.writeFileSync, appendFileSync: fs.appendFileSync, mkdirSync: fs.mkdirSync };
const files = new Map<string, { accesses: Set<PreparationAccess>; first: TracedState }>();
const commands: TracedCommand[] = [], catalogImporters = new Set<string>(), unsupported = new Set<string>();
// Node's module loader reads sources through the public fs functions; inside the module hooks those reads are the
// module load itself, which the load hook records.
let loaderDepth = 0;
// A worker thread can be terminated without running its exit handlers, so it also journals each new observation as it happens.
const recordName = workerThreads.isMainThread ? String(process.pid) : `${process.pid}-${workerThreads.threadId}`;
const journal = workerThreads.isMainThread ? null : resolve(traceDirectory, `${recordName}.jsonl`);
function journalLine(entry: Record<string, unknown>) { if (journal) original.appendFileSync(journal, JSON.stringify(entry) + '\n'); }
function markUnsupported(reason: string) { if (!unsupported.has(reason)) { unsupported.add(reason); journalLine({ unsupported: reason }); } }

function pathOf(value: unknown): string | null {
  if (typeof value === 'string') return resolve(value);
  if (value instanceof URL) return value.protocol === 'file:' ? fileURLToPath(value) : null;
  if (Buffer.isBuffer(value) && value.byteLength < 4096 && !value.includes(0)) return resolve(value.toString());
  return null;
}
function firstState(path: string): TracedState {
  let stats;
  try { stats = original.statSync(path, { throwIfNoEntry: false }); } catch { return { missing: true }; }
  if (!stats) return { missing: true };
  const state: TracedState = { size: stats.size, modified: stats.mtimeMs, ...(stats.isDirectory() ? { directory: true as const } : {}) };
  if (stats.isFile() && DESCRIPTOR_PATH.test(path)) {
    const text = original.readFileSync(path, 'utf8');
    state.views = { registry: descriptorDigest(text, 'registry'), recipe: descriptorDigest(text, 'recipe'), pins: descriptorDigest(text, 'pins') };
  }
  return state;
}
function note(value: unknown, access: PreparationAccess) {
  if (loaderDepth > 0 && access !== 'load') return;
  const path = pathOf(value);
  if (!path || path.includes(`${sep}node_modules${sep}`) || path === traceDirectory || path.startsWith(traceDirectory + sep)) return;
  let file = files.get(path);
  if (!file) files.set(path, file = { accesses: new Set(), first: access === 'write' ? {} : firstState(path) });
  if (!file.accesses.has(access)) { file.accesses.add(access); journalLine({ path, access, first: file.first }); }
}

type Method = (this: unknown, ...args: unknown[]) => unknown;
type Recorder = (args: unknown[]) => unknown[] | void;
function wrap(target: object, name: string, record: Recorder) {
  const owner = target as Record<string | symbol, unknown>, method = owner[name];
  if (typeof method !== 'function') return;
  const call = (implementation: Method) => function (this: unknown, ...args: unknown[]) {
    let actual = args;
    try { actual = record(args) ?? args; } catch (error) { markUnsupported(`recording ${name} failed: ${String(error)}`); }
    return implementation.apply(this, actual);
  };
  const wrapped = call(method as Method);
  const descriptors: PropertyDescriptorMap = Object.getOwnPropertyDescriptors(method);
  // util.promisify uses a custom implementation that calls the unwrapped function, so record it too.
  const custom = (method as unknown as Record<symbol, unknown>)[promisify.custom];
  if (typeof custom === 'function') descriptors[promisify.custom] = { value: call(custom as Method), configurable: true };
  Object.defineProperties(wrapped, descriptors);
  owner[name] = wrapped;
}
const writes = (flags: unknown) => typeof flags === 'string' ? /[wax+]/u.test(flags)
  : typeof flags === 'number' && (flags & (fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND)) !== 0;
const recursive = (options: unknown) => options !== null && typeof options === 'object' && (options as { recursive?: unknown }).recursive === true;
const one = (access: PreparationAccess): Recorder => args => { note(args[0], access); };

const fileSystems: object[] = [fs, fs.promises];
for (const target of fileSystems) {
  const variants = target === fs ? (name: string) => [name, `${name}Sync`] : (name: string) => [name];
  for (const name of variants('readFile')) wrap(target, name, one('read'));
  for (const name of variants('open')) wrap(target, name, args => { note(args[0], writes(args[1]) ? 'write' : 'read'); });
  for (const probe of ['stat', 'lstat', 'access', 'realpath', 'readlink', 'statfs', 'exists']) for (const name of variants(probe)) wrap(target, name, one('probe'));
  for (const list of ['readdir', 'opendir']) for (const name of variants(list)) wrap(target, name, args => { note(args[0], recursive(args[1]) ? 'tree' : 'list'); });
  for (const change of ['writeFile', 'appendFile', 'truncate', 'utimes', 'lutimes', 'chmod', 'lchmod', 'chown', 'lchown', 'mkdir', 'rm', 'rmdir', 'unlink']) {
    for (const name of variants(change)) wrap(target, name, one('write'));
  }
  for (const name of variants('copyFile')) wrap(target, name, args => { note(args[0], 'read'); note(args[1], 'write'); });
  for (const name of variants('cp')) wrap(target, name, args => { note(args[0], 'tree'); note(args[1], 'write'); });
  for (const name of variants('rename')) wrap(target, name, args => { note(args[0], 'write'); note(args[1], 'write'); });
  for (const name of variants('link')) wrap(target, name, args => { note(args[0], 'read'); note(args[1], 'write'); });
  for (const name of variants('symlink')) wrap(target, name, args => { note(args[1], 'write'); });
  for (const name of [...variants('glob'), 'watch', 'watchFile']) wrap(target, name, () => { markUnsupported(`fs.${name}`); });
}
wrap(fs, 'createReadStream', one('read'));
wrap(fs, 'createWriteStream', one('write'));

// A child Node process inherits the trace unless its caller replaced the environment; put the trace back in that case.
function tracedEnvironment(environment: Record<string, string | undefined>) {
  const options = environment.NODE_OPTIONS ?? '';
  return { ...environment, [PREPARATION_TRACE_VARIABLE]: traceDirectory, NODE_OPTIONS: options.includes(importFlag) ? options : `${options} ${importFlag}`.trim() };
}
function started(name: string): Recorder {
  return args => {
    const optionsAt = args.findIndex((value, index) => index > 0 && value !== null && typeof value === 'object' && !Array.isArray(value));
    const options = optionsAt > 0 ? args[optionsAt] as { cwd?: unknown; env?: Record<string, string | undefined>; shell?: unknown } : undefined;
    const listed = Array.isArray(args[1]) ? args[1].map(String) : [];
    const shell = name === 'exec' || name === 'execSync' || Boolean(options?.shell);
    const command = { command: name === 'fork' ? process.execPath : String(args[0]), args: name === 'fork' ? [String(args[0]), ...listed] : listed,
      cwd: resolve(typeof options?.cwd === 'string' ? options.cwd : process.cwd()), shell };
    commands.push(command); journalLine({ command });
    if (!options?.env) return;
    const actual = [...args];
    actual[optionsAt] = { ...options, env: tracedEnvironment(options.env) };
    return actual;
  };
}
for (const name of ['spawn', 'spawnSync', 'execFile', 'execFileSync', 'exec', 'execSync', 'fork']) wrap(childProcess, name, started(name));

// Worker threads inherit neither module hooks nor these wrappers, so each worker imports this recorder itself and writes its own record.
const Worker = workerThreads.Worker;
(workerThreads as unknown as Record<string, unknown>).Worker = class extends Worker {
  constructor(file: ConstructorParameters<typeof Worker>[0], options: ConstructorParameters<typeof Worker>[1] = {}) {
    const execArgv = options.execArgv ?? process.execArgv;
    super(file, { ...options, execArgv: execArgv.includes(importFlag) ? execArgv : [...execArgv, importFlag] });
  }
};
syncBuiltinESMExports();

// Sharp opens path inputs and outputs in libvips, outside Node's file system. It ships separate CommonJS and ES builds.
try {
  const builds = new Set<unknown>([createRequire(import.meta.url)('sharp'), (await import(import.meta.resolve('sharp'))).default]);
  for (const sharp of builds) {
    const prototype = (sharp as { prototype: object }).prototype;
    wrap(prototype, '_createInputDescriptor', args => { if (typeof args[0] === 'string') note(args[0], 'read'); });
    wrap(prototype, 'toFile', args => { if (typeof args[0] === 'string') note(args[0], 'write'); });
  }
} catch (error) {
  if (!(error instanceof Error && 'code' in error && ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(String(error.code)))) markUnsupported(`sharp paths are not recorded: ${String(error)}`);
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    loaderDepth++;
    let result;
    try { result = nextResolve(specifier, context); } finally { loaderDepth--; }
    if (context.parentURL?.startsWith('file:') && result.url.startsWith('file:') && fileURLToPath(result.url).endsWith(`${sep}${CATALOG_MODULE.split('/').join(sep)}`)) {
      const importer = fileURLToPath(context.parentURL);
      if (!catalogImporters.has(importer)) { catalogImporters.add(importer); journalLine({ importer }); }
    }
    return result;
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:')) note(new URL(url), 'load');
    loaderDepth++;
    try { return nextLoad(url, context); } finally { loaderDepth--; }
  },
});

original.mkdirSync(traceDirectory, { recursive: true });
// A worker thread may be terminated before it reads anything; its empty journal is still the record that it ran.
if (journal) original.writeFileSync(journal, '');
original.writeFileSync(resolve(traceDirectory, `${recordName}.started`), '');
process.on('exit', () => {
  const trace: PreparationTrace = { schema: PREPARATION_TRACE_SCHEMA, pid: process.pid, argv: process.argv,
    files: Object.fromEntries([...files].map(([path, file]) => [path, { accesses: [...file.accesses].sort(), first: file.first }])),
    commands, catalogImporters: [...catalogImporters].sort(), unsupported: [...unsupported].sort() };
  original.writeFileSync(resolve(traceDirectory, `${recordName}.json`), JSON.stringify(trace));
});
