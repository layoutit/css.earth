import { sha256 } from '@cssearth/core/node';
import { isArray, hasErrorCode } from '@cssearth/core';
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path";
import { DESCRIPTOR_PATH, PREPARATION_TRACE_SCHEMA, REGISTRY_MODULE, descriptorDigest,
  type DescriptorView, type PreparationAccess, type TracedCommand, type TracedState } from './preparation-trace-format.mts';

export const PREPARATION_RECEIPT_SCHEMA = "cssearth-preparation-receipt@2";

/**
 * How a receipt fingerprints one path. bytes: file contents; absent: no entry; file or directory: an entry of
 * that kind; names: a directory's entry names; tree: every name and file below a directory; descriptor-*: one
 * owner's view of an object.json (see descriptorView).
 */
export type PreparationEvidence = 'bytes' | 'absent' | 'file' | 'directory' | 'names' | 'tree' | `descriptor-${DescriptorView}`;
export interface PreparationRecord { evidence: PreparationEvidence; bytes?: number; sha256?: string; }
export type PreparationRecords = Record<string, PreparationRecord>;
export interface PreparationReceipt { schema: string; inputs: PreparationRecords; outputs: PreparationRecords; programs: string[]; metadata: Readonly<Record<string, unknown>> | null; }
export interface PreparationTraces {
  files: Map<string, { accesses: Set<PreparationAccess>; first: TracedState[] }>;
  commands: TracedCommand[]; catalogImporters: Set<string>; unsupported: Set<string>;
}

const EVIDENCE = new Set<string>(['bytes', 'absent', 'file', 'directory', 'names', 'tree', 'descriptor-registry', 'descriptor-recipe', 'descriptor-pins']);
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !isArray(value);

function safePath(root: string, path: string) {
  assert.equal(typeof path, "string");
  assert.ok(path && !isAbsolute(path) && !path.split(/[\\/]/).includes(".."), `Unsafe preparation path: ${path}`);
  const absolute = resolve(root, path);
  assert.ok(!relative(root, absolute).startsWith(".."), `Preparation path escaped its root: ${path}`);
  return absolute;
}

async function fileDigest(path: string) {
  const hash = createHash("sha256");
  let bytes = 0;
  for await (const value of createReadStream(path)) {
    const chunk: unknown = value;
    assert.ok(chunk instanceof Uint8Array, "Preparation stream must contain bytes");
    bytes += chunk.length;
    hash.update(chunk);
  }
  return { bytes, sha256: hash.digest("hex") };
}

async function treeDigest(path: string): Promise<string> {
  const entry = await stat(path);
  if (entry.isFile()) return (await fileDigest(path)).sha256;
  const lines = [];
  for (const child of (await readdir(path, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`${child.name}${child.isDirectory() ? '/' : ''} ${await treeDigest(join(path, child.name))}`);
  }
  return sha256(lines.join("\n"));
}

/**
 * The current state of one path under the requested evidence, or null when the path no longer has that shape.
 * A link is observed through its target: the receipt records what preparation read through the checkout path.
 */
export async function observePreparationPath(root: string, path: string, evidence: PreparationEvidence): Promise<PreparationRecord | null> {
  const absolute = safePath(root, path);
  const missing = (error: unknown) => hasErrorCode(error, "ENOENT") || hasErrorCode(error, "ENOTDIR");
  try { await lstat(absolute); }
  catch (error) { if (missing(error)) return evidence === 'absent' ? { evidence } : null; throw error; }
  if (evidence === 'absent') return null;
  let canonical;
  try { canonical = await realpath(absolute); }
  catch (error) { if (missing(error)) return null; throw error; }
  const entry = await stat(canonical);
  if (evidence === 'file' || evidence === 'directory') return (evidence === 'file' ? entry.isFile() : entry.isDirectory()) ? { evidence } : null;
  if (evidence === 'names') {
    if (!entry.isDirectory()) return null;
    const names = (await readdir(canonical, { withFileTypes: true })).map(child => `${child.name}${child.isDirectory() ? '/' : ''}`).sort();
    return { evidence, sha256: sha256(names.join("\n")) };
  }
  if (evidence === 'tree') return { evidence, sha256: await treeDigest(canonical) };
  if (!entry.isFile()) return null;
  if (evidence === 'bytes') return { evidence, ...await fileDigest(canonical) };
  return { evidence, sha256: descriptorDigest(await readFile(canonical, "utf8"), evidence.slice('descriptor-'.length) as DescriptorView) };
}

/** Merge every process record in a trace directory. A process that started without leaving a record makes the trace incomplete. */
export async function readPreparationTraces(directory: string): Promise<PreparationTraces> {
  const traces: PreparationTraces = { files: new Map(), commands: [], catalogImporters: new Set(), unsupported: new Set() };
  const names = new Set(await readdir(directory));
  for (const name of names) {
    const record = name.replace(/\.started$/u, '');
    if (name.endsWith('.started') && !names.has(`${record}.json`) && !names.has(`${record}.jsonl`)) traces.unsupported.add(`process ${record} left no preparation record`);
    // A worker thread terminated before its exit handler leaves only the journal it wrote as it ran.
    if (name.endsWith('.jsonl') && !names.has(name.replace(/\.jsonl$/u, '.json'))) {
      const journaled = new Set<string>();
      for (const line of (await readFile(resolve(directory, name), 'utf8')).split('\n').filter(Boolean)) {
        const entry: unknown = JSON.parse(line);
        assert.ok(isRecord(entry), `Invalid preparation journal line in ${name}`);
        if (typeof entry.path === 'string' && typeof entry.access === 'string' && isRecord(entry.first)) {
          const file = traces.files.get(entry.path) ?? { accesses: new Set<PreparationAccess>(), first: [] };
          if (!journaled.has(entry.path)) { journaled.add(entry.path); file.first.push(entry.first as TracedState); }
          file.accesses.add(entry.access as PreparationAccess);
          traces.files.set(entry.path, file);
        } else if (isRecord(entry.command) && typeof entry.command.command === 'string' && isArray(entry.command.args) && typeof entry.command.cwd === 'string') {
          traces.commands.push({ command: entry.command.command, args: entry.command.args.map(String), cwd: entry.command.cwd, shell: entry.command.shell === true });
        } else if (typeof entry.importer === 'string') traces.catalogImporters.add(entry.importer);
        else if (typeof entry.unsupported === 'string') traces.unsupported.add(entry.unsupported);
        else assert.fail(`Invalid preparation journal line in ${name}`);
      }
      continue;
    }
    if (!name.endsWith('.json')) continue;
    const trace: unknown = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
    assert.ok(isRecord(trace) && trace.schema === PREPARATION_TRACE_SCHEMA && isRecord(trace.files) && isArray(trace.commands) &&
      isArray(trace.catalogImporters) && isArray(trace.unsupported), `Invalid preparation trace ${name}`);
    for (const [path, value] of Object.entries(trace.files)) {
      assert.ok(isRecord(value) && isArray(value.accesses) && isRecord(value.first), `Invalid preparation trace entry for ${path}`);
      const file = traces.files.get(path) ?? { accesses: new Set<PreparationAccess>(), first: [] };
      for (const access of value.accesses) file.accesses.add(access as PreparationAccess);
      file.first.push(value.first as TracedState);
      traces.files.set(path, file);
    }
    for (const command of trace.commands) {
      assert.ok(isRecord(command) && typeof command.command === 'string' && isArray(command.args) && typeof command.cwd === 'string', `Invalid preparation command in ${name}`);
      traces.commands.push({ command: command.command, args: command.args.map(String), cwd: command.cwd, shell: command.shell === true });
    }
    for (const importer of trace.catalogImporters) traces.catalogImporters.add(String(importer));
    for (const reason of trace.unsupported) traces.unsupported.add(String(reason));
  }
  return traces;
}

async function checkoutPath(root: string) {
  const roots = [...new Set([resolve(root), await realpath(root)])];
  return (absolute: string) => {
    for (const base of roots) {
      const path = relative(base, absolute);
      if (path && !path.startsWith('..') && !isAbsolute(path)) return path.split(sep).join('/');
    }
    return null;
  };
}

/**
 * Decide what a traced preparation read (inputs) and wrote (outputs). A path the run wrote is an output even when
 * the run read it first: preparation reads its previous outputs, so reusing a receipt assumes preparing again from
 * them reproduces them. An object.json is split by owner: the body's authored view is an input and its preparation
 * pins are an output; another body's descriptor that reached the run only through site/objects.mts counts only the
 * registry fields.
 */
async function classifyTrace(root: string, objectId: string, traces: PreparationTraces, sharedFiles: readonly string[]) {
  const inside = await checkoutPath(root), refusals = [...traces.unsupported];
  const inputs = new Map<string, { evidence: PreparationEvidence; first: TracedState[] }>(), outputs = new Map<string, PreparationEvidence>();
  const importers = [...traces.catalogImporters].map(inside);
  const registryOnly = importers.every(importer => importer === REGISTRY_MODULE);
  const presence = (first: TracedState[], evidence: PreparationEvidence): PreparationEvidence =>
    first.some(state => state.missing) ? 'absent' : first.some(state => state.directory) && evidence !== 'names' && evidence !== 'tree' ? 'directory' : evidence;
  for (const [absolute, { accesses, first }] of traces.files) {
    const path = inside(absolute);
    if (!path || path === '.git' || path.startsWith('.git/') || path.startsWith('node_modules/')) continue;
    const wrote = accesses.has('write'), read = accesses.has('read') || accesses.has('tree'), loaded = accesses.has('load');
    const descriptor = DESCRIPTOR_PATH.exec(path);
    if (descriptor && descriptor.index === 0) {
      const own = descriptor[1] === objectId;
      if (wrote && !own) { refusals.push(`it writes ${path}, which belongs to another object`); continue; }
      if (wrote) outputs.set(path, 'descriptor-pins');
      if (read || loaded) inputs.set(path, { evidence: presence(first, own ? 'descriptor-recipe' : !read && registryOnly ? 'descriptor-registry' : 'bytes'), first });
      else if (!wrote) inputs.set(path, { evidence: presence(first, 'file'), first });
      continue;
    }
    if (wrote) outputs.set(path, 'bytes');
    else if (accesses.has('tree')) inputs.set(path, { evidence: presence(first, 'tree'), first });
    else if (read || loaded) inputs.set(path, { evidence: presence(first, 'bytes'), first });
    else if (accesses.has('list')) inputs.set(path, { evidence: presence(first, 'names'), first });
    else inputs.set(path, { evidence: presence(first, 'file'), first });
  }
  const programs = new Set<string>();
  for (const command of traces.commands) {
    const program = basename(command.command);
    if (command.command === process.execPath || program === 'node') continue;
    programs.add(program);
    if (command.shell) refusals.push(`it runs a shell command (${program})`);
    // Playwright's browser receives preparation data through the page, never checkout paths.
    else if (command.command.split(sep).includes('ms-playwright')) continue;
    else if (program === 'unzip' || program === 'cwebp') {
      for (const argument of command.args) {
        const path = inside(resolve(command.cwd, argument));
        if (path && !outputs.has(path) && (await observePreparationPath(root, path, 'bytes'))) inputs.set(path, { evidence: 'bytes', first: [] });
      }
    } else refusals.push(`it starts ${program}, whose file access is not recorded`);
  }
  for (const path of sharedFiles) inputs.set(path, { evidence: 'bytes', first: [] });
  return { inputs, outputs, refusals, programs: [...programs].sort() };
}

/** Whether a traced input still holds what the run saw when it first touched it. */
async function unchangedSinceFirstAccess(root: string, path: string, evidence: PreparationEvidence, first: readonly TracedState[], outputs: ReadonlyMap<string, PreparationEvidence>) {
  const absolute = resolve(root, path);
  for (const state of first) {
    // A process whose first access was a write saw nothing to compare.
    if (!state.missing && state.size === undefined) continue;
    const current = await lstat(absolute).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT') || hasErrorCode(error, 'ENOTDIR')) return null; throw error; });
    if (state.missing) { if (current) return false; continue; }
    if (!current) return false;
    if (evidence.startsWith('descriptor-')) {
      const view = evidence.slice('descriptor-'.length) as DescriptorView;
      if (state.views?.[view] !== descriptorDigest(await readFile(absolute, 'utf8'), view)) return false;
    } else if (evidence === 'names' || evidence === 'tree') {
      // The run's own outputs change the directories it writes into.
      if (![...outputs.keys()].some(output => output.startsWith(`${path}/`)) && current.mtimeMs !== state.modified) return false;
    } else if (evidence === 'bytes' && (current.size !== state.size || current.mtimeMs !== state.modified)) return false;
  }
  return true;
}

/**
 * Write the receipt for a finished preparation from its trace, or refuse and remove any previous receipt when the
 * trace cannot account for every file the run used.
 */
export async function writePreparationReceipt({ root, path, objectId, traces, sharedFiles = [], metadata = null }: {root: string; path: string; objectId: string; traces: PreparationTraces; sharedFiles?: readonly string[]; metadata?: Readonly<Record<string, unknown>> | null}) {
  const destination = safePath(root, path);
  const { inputs, outputs, refusals, programs } = await classifyTrace(root, objectId, traces, sharedFiles);
  outputs.delete(path);
  const receipt: PreparationReceipt = { schema: PREPARATION_RECEIPT_SCHEMA, inputs: {}, outputs: {}, programs, metadata };
  const changed: string[] = [];
  for (const [input, { evidence, first }] of [...inputs].sort(([a], [b]) => a.localeCompare(b))) {
    if (refusals.length) break;
    const record = await observePreparationPath(root, input, evidence);
    if (!record || !await unchangedSinceFirstAccess(root, input, evidence, first, outputs)) changed.push(input);
    else receipt.inputs[input] = record;
  }
  if (changed.length) refusals.push(`${changed.join(', ')} changed during preparation`);
  for (const [output, evidence] of [...outputs].sort(([a], [b]) => a.localeCompare(b))) {
    if (refusals.length) break;
    const record = await observePreparationPath(root, output, evidence);
    // Directories, temporary files and removed files are not outputs.
    if (record) receipt.outputs[output] = record;
    else if (evidence !== 'bytes') refusals.push(`${output} is missing after preparation`);
  }
  if (!refusals.length && !Object.keys(receipt.outputs).length) refusals.push('it wrote no files');
  if (refusals.length) {
    await rm(destination, { force: true });
    return { receipt: null, refusal: `The receipt was not written because ${refusals.join('; ')}.`, changed };
  }
  await mkdir(resolve(destination, '..'), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(receipt) + "\n", { flag: "wx" });
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
  return { receipt, refusal: null, changed };
}

function validRecords(value: unknown): value is PreparationRecords {
  return isRecord(value) && Object.values(value).every(record => isRecord(record) && typeof record.evidence === 'string' && EVIDENCE.has(record.evidence));
}

/** A receipt is reusable only while every input and output still matches it. */
export async function readPreparationReceipt({ root, path }: {root: string; path: string}): Promise<PreparationReceipt | null> {
  try {
    const receipt: unknown = JSON.parse(await readFile(safePath(root, path), "utf8"));
    assert.ok(isRecord(receipt) && receipt.schema === PREPARATION_RECEIPT_SCHEMA);
    assert.ok(validRecords(receipt.inputs) && validRecords(receipt.outputs) && isArray(receipt.programs));
    assert.ok(receipt.metadata === null || isRecord(receipt.metadata));
    assert.ok(Object.keys(receipt.outputs).length, "Preparation receipt has no outputs");
    assert.ok(!Object.hasOwn(receipt.outputs, path), "Preparation receipt cannot verify itself");
    for (const records of [receipt.inputs, receipt.outputs]) {
      for (const [file, record] of Object.entries(records)) assert.deepEqual(await observePreparationPath(root, file, record.evidence), record, `${file} changed`);
    }
    // The shape checks and the observations above validate every record.
    return receipt as unknown as PreparationReceipt;
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof Error && "code" in error && ["ENOENT", "ENOTDIR", "ERR_ASSERTION"].includes(String(error.code))) return null;
    throw error;
  }
}
