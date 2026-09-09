#!/usr/bin/env node
// One-off B3 delivery check. Uses the repository's existing acquisition and pin APIs.
import {readFile, writeFile, mkdir, readdir, lstat, realpath, statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname, relative, sep} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const run = promisify(execFile);
const cohort = 'callisto hyperion phoebe proteus titania miranda'.split(' ');
const selection = process.argv.slice(2).find(arg=>arg.startsWith('--objects='))?.slice(10).split(',');
const ids = selection ?? cohort;
if (!ids.length || new Set(ids).size!==ids.length || ids.some(id=>!cohort.includes(id))) throw new Error('Select unique B3 objects.');
const args = process.argv.slice(2);
if (args.some(arg => !arg.startsWith('--project=') && !arg.startsWith('--destination=') && !arg.startsWith('--objects=') && arg !== '--restore')) {
  throw new Error('Usage: node b3-fresh-source-restore.mjs --project=/absolute/repo --destination=/tmp/fresh-dir [--restore]');
}
const option = name => {
  const matches = args.filter(arg => arg.startsWith(`--${name}=`));
  if (matches.length !== 1) throw new Error(`Supply exactly one --${name}= argument.`);
  return matches[0].slice(name.length + 3);
};
const project = await realpath(resolve(option('project')));
const destination = resolve(option('destination'));
const restore = args.includes('--restore');
const git = async (...argv) => (await run('git', argv, {cwd: project, maxBuffer: 8 * 1024 * 1024})).stdout.trimEnd();
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const apiPath = resolve(project, 'tools/objects/dist/operations.js');
const apiBytes = await readFile(apiPath);
const {parseSourceManifest, assertSourceBytes, publishPinnedSource, restoreMissingSources, verifySources, containedPath} = await import(pathToFileURL(apiPath).href);
const prefix = id => `src/planets/${id}/source`;
const tracked = new Set((await git('ls-files', '--', ...ids.map(prefix))).split('\n'));
const unmerged = await git('ls-files', '-u', '--', ...ids.map(prefix));
if (unmerged) throw new Error('B3 source paths still have merge conflicts; freeze them before restoration.');
const bodies = [];

// Read and freeze only tracked bytes, never existing ignored source/cache assets.
for (const id of ids) {
  const source = resolve(project, prefix(id));
  if (!tracked.has(`${prefix(id)}/manifest.json`)) throw new Error(`${id}: manifest is not tracked.`);
  const manifestBytes = await readFile(resolve(source, 'manifest.json'));
  const manifest = parseSourceManifest(JSON.parse(manifestBytes), id);
  const entries = ['inputs', 'generatedIntermediates', 'documents'].flatMap(collection => manifest[collection].map(entry => ({...entry, collection})));
  const seeded = [], missing = [], operations = [];
  for (const entry of entries) {
    if (tracked.has(`${prefix(id)}/${entry.path}`)) {
      const path = containedPath(source, entry.path);
      if (!(await lstat(path)).isFile()) throw new Error(`Tracked metadata is not a regular file: ${id}/${entry.path}`);
      const bytes = await readFile(path);
      assertSourceBytes(entry, bytes);
      seeded.push({entry, bytes});
    } else missing.push(entry);
  }
  const acquisition = seeded.find(item => item.entry.path === 'preparation/acquisition.json');
  if (!acquisition) throw new Error(`${id}: tracked acquisition recipe is missing.`);
  const plan = JSON.parse(acquisition.bytes);
  if (plan.schema !== 'cssearth-acquisition-plan@1' || !Array.isArray(plan.operations)) throw new Error(`${id}: invalid acquisition recipe.`);
  const available = new Set(seeded.map(item => item.entry.path));
  for (const step of plan.operations) {
    if (!missing.some(entry => entry.path === step.path)) continue;
    if (!['download', 'dsk-mesh'].includes(step.kind)) throw new Error(`${id}/${step.path}: unsupported by this bounded wrapper: ${step.kind}`);
    if (operations.some(previous => previous.path === step.path)) throw new Error(`${id}/${step.path}: duplicate restoration operation.`);
    if (step.kind === 'download' && (!/^https:\/\//.test(step.url) || step.encoding)) throw new Error(`${id}/${step.path}: unexpected download transport/encoding.`);
    if (step.kind === 'dsk-mesh' && !available.has(step.recipe.inputPath)) throw new Error(`${id}: DSK input is not restored before conversion.`);
    operations.push(step); available.add(step.path);
  }
  for (const entry of missing) if (!available.has(entry.path)) throw new Error(`${id}/${entry.path}: no authored restoration operation.`);
  bodies.push({id, manifest, manifestBytes, seeded, missing, plan, operations});
}

const totals = {
  bodies: bodies.length,
  sourceEntries: bodies.reduce((n, b) => n + b.seeded.length + b.missing.length, 0),
  copiedTrackedEntries: bodies.reduce((n, b) => n + b.seeded.length, 0),
  copiedTrackedBytes: bodies.reduce((n, b) => n + b.seeded.reduce((m, x) => m + x.bytes.length, 0), 0),
  restoredIgnoredEntries: bodies.reduce((n, b) => n + b.missing.length, 0),
  restoredIgnoredBytes: bodies.reduce((n, b) => n + b.missing.reduce((m, x) => m + x.expectedBytes, 0), 0),
  manifestBytes: bodies.reduce((n, b) => n + b.manifestBytes.length, 0),
};
const report = {
  schema: 'cssearth-b3-fresh-source-restoration@1', status: restore ? 'PREFLIGHT' : 'PLAN_ONLY_NOT_RUN',
  project, destination, codeHead: await git('rev-parse', 'HEAD'), startedAt: new Date().toISOString(),
  api: {path: relative(project, apiPath), bytes: apiBytes.length, sha256: sha256(apiBytes)},
  helperSha256: sha256(await readFile(new URL(import.meta.url))), totals,
  scope: 'All declared ignored sources for the selected B3 packages; complete source closure with individually copied, pinned tracked entries. No runtime assets, cache links, copied ignored files or new checkout.',
  bodies: bodies.map(b => ({id: b.id, status: 'PENDING', sourceRoot: `sources/${b.id}`, manifestSha256: sha256(b.manifestBytes),
    copied: b.seeded.map(({entry}) => ({path: entry.path, bytes: entry.expectedBytes, sha256: entry.expectedSha256})),
    restored: b.missing.map(entry => ({path: entry.path, bytes: entry.expectedBytes, sha256: entry.expectedSha256,
      operation: b.operations.find(op => op.path === entry.path)}))})),
  requests: [],
};
console.log(JSON.stringify({status: report.status, project, destination, totals}, null, 2));
if (!restore) process.exit(0);

// Root must assign the serial execution slot before --restore. No source prep/build/browser run is started here.
const parent = await realpath(dirname(destination));
const temporaryRoots = await Promise.all(['/tmp', tmpdir()].map(path => realpath(path)));
if (!temporaryRoots.some(root => parent === root || parent.startsWith(root + sep))) throw new Error('Destination must be inside an existing temporary directory.');
if (parent !== dirname(destination) && !(dirname(destination) === '/tmp' && parent === '/private/tmp')) {
  throw new Error('Use the canonical temporary parent path; do not restore through a directory symlink.');
}
try {
  const stat = await lstat(destination);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (await readdir(destination)).length) throw new Error('Destination must be absent or an empty real directory.');
} catch (error) {if (error.code !== 'ENOENT') throw error;}
const disk = await statfs(parent, {bigint: true});
const freeBytes = disk.bavail * disk.bsize;
if (freeBytes < 25n * 1024n ** 3n) throw new Error('Less than 25 GiB free; restoration not started.');
if (freeBytes < 60n * 1024n ** 3n) console.warn('Warning: less than 60 GiB free.');
report.freeBytesBefore = String(freeBytes);
if (bodies.some(body => body.operations.some(step => step.kind !== 'download'))) throw new Error('This B3 restoration cohort requires a non-download transform; review its toolchain before running.');
await mkdir(destination, {recursive: true});
const reportPath = resolve(destination, 'report.json');
const save = async () => writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
report.status = 'RUNNING'; await save();

try {
  // Freeze all source metadata before network work, with original manifest pin checks.
  for (const body of bodies) {
    const sourceRoot = resolve(destination, 'sources', body.id);
    await mkdir(sourceRoot, {recursive: true});
    await writeFile(resolve(sourceRoot, 'manifest.json'), body.manifestBytes, {flag: 'wx'});
    for (const item of body.seeded) await publishPinnedSource({sourceRoot, entry: item.entry, bytes: item.bytes});
  }
  for (const [index, body] of bodies.entries()) {
    const record = report.bodies[index], sourceRoot = resolve(destination, record.sourceRoot);
    record.status = 'RUNNING'; record.startedAt = new Date().toISOString(); await save();
    try {
      const transport = {fetch: async (url, init) => {
        if (init?.method && init.method !== 'GET') throw new Error('Unexpected non-GET acquisition request.');
        const request = {body: body.id, url, startedAt: new Date().toISOString()}; report.requests.push(request);
        try {const response = await fetch(url, init); request.httpStatus = response.status; request.responseUrl = response.url; return response;}
        catch (error) {request.error = error.message; throw error;}
        finally {request.responseAt = new Date().toISOString(); await save();}
      }};
      record.acquisition = await restoreMissingSources({sourceRoot, manifest: body.manifest, plan: body.plan, missing: body.missing.map(entry => entry.path), transport});
      record.verification = await verifySources({sourceRoot, manifest: body.manifest});
      record.status = 'PASS';
    } catch (error) {record.status = 'FAILED'; record.error = error.stack ?? String(error);}
    record.finishedAt = new Date().toISOString(); await save();
    console.log(`${body.id}: ${record.status}`);
  }
  report.status = report.bodies.every(body => body.status === 'PASS') ? 'PASS' : 'FAILED';
} catch (error) {report.status = 'FAILED'; report.error = error.stack ?? String(error);}
finally {report.finishedAt = new Date().toISOString(); await save();}
console.log(JSON.stringify({status: report.status, reportPath, passedBodies: report.bodies.filter(body => body.status === 'PASS').length}));
if (report.status !== 'PASS') process.exitCode = 1;
