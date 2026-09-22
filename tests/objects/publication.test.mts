import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, mkdir, readFile, readdir, writeFile, rm, symlink } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { preparedAssetWrites, publishPreparedObject, readPreparedJsonOutputs } from '../../tools/objects/publication.mts';
import { writePreparedSet } from '../../tools/write-prepared-set.mts';
const manifest = (values: Record<string,string>) => ({ schema: 'cssearth-inventory@1', assets: Object.entries(values).map(([filename,text]) => ({filename,bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')})) });
test('private material masters stay staged while all consumer JSON is preflighted',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-publication-json-'));
 try {
  await mkdir(join(root,'.material-masters'));
  await writeFile(join(root,'.material-masters','surface.png'),'private intermediate');
  await writeFile(join(root,'runtime.json'),'{}\n');
  await writeFile(join(root,'content.json'),'{}\n');
  assert.deepEqual(await readPreparedJsonOutputs(root),[
   {filename:'content.json',path:join(root,'content.json')},
   {filename:'runtime.json',path:join(root,'runtime.json')},
  ]);
  await writeFile(join(root,'runtime.json'),'{');
  await assert.rejects(readPreparedJsonOutputs(root),SyntaxError);
  await writeFile(join(root,'runtime.json'),'{}\n');
  await writeFile(join(root,'unexpected.mjs'),'export default null;');
  await assert.rejects(readPreparedJsonOutputs(root),/only regular JSON/);
  await rm(join(root,'unexpected.mjs'));
  await symlink(join(root,'runtime.json'),join(root,'linked.json'));
  await assert.rejects(readPreparedJsonOutputs(root),/only regular JSON/);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('publication ships only verified consumers and retires previous assets',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-publication-')),stage=join(root,'stage'),destination=join(root,'public');
 try {
  await mkdir(stage);await mkdir(destination);
  for(const [name,value]of Object.entries({'one.webp':'new','two.webp':'two','unused.webp':'offline'}))await writeFile(join(stage,name),value);
  await writeFile(join(destination,'one.webp'),'old');await writeFile(join(destination,'retired.webp'),'retired');
  const args={id:'fixture',stage,destination,previous:manifest({'one.webp':'old','retired.webp':'retired'}),manifest:manifest({'one.webp':'new','two.webp':'two'})};
  await writePreparedSet(await preparedAssetWrites(args));
  assert.deepEqual((await readdir(destination)).sort(),['one.webp','two.webp']);
  assert.equal(await readFile(join(stage,'unused.webp'),'utf8'),'offline');
 } finally { await rm(root,{recursive:true,force:true}); }
});
test('drift and unknown files fail before overwriting canonical files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cssearth-publication-')),stage=join(root,'stage'),destination=join(root,'public');
 try {
  await mkdir(stage);await mkdir(destination);await writeFile(join(stage,'one.webp'),'corrupt');await writeFile(join(destination,'one.webp'),'old');
  const args={id:'fixture',stage,destination,previous:manifest({'one.webp':'old'}),manifest:manifest({'one.webp':'new'})};
  await assert.rejects(preparedAssetWrites(args),/drifted/);assert.equal(await readFile(join(destination,'one.webp'),'utf8'),'old');
  await writeFile(join(stage,'one.webp'),'new');await writeFile(join(destination,'user.txt'),'keep');
  await assert.rejects(preparedAssetWrites(args),/Unowned canonical asset/);assert.equal(await readFile(join(destination,'user.txt'),'utf8'),'keep');assert.equal(await readFile(join(destination,'one.webp'),'utf8'),'old');
 }finally{await rm(root,{recursive:true,force:true});}
});

async function put(path: string, text: string) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, text); }
async function snapshot(root: string, prefix = ''): Promise<[string, string][]> {
  const files: [string, string][] = [];
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...await snapshot(root, path));
    else files.push([path, (await readFile(join(root, path))).toString('base64')]);
  }
  return files.sort(([a], [b]) => a.localeCompare(b));
}
async function publicationFixture() {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-whole-publication-'));
  const stage = join(root, 'stage'), canonical = join(root, 'canonical'), objectDirectory = join(canonical, 'object');
  const outputDirectory = join(objectDirectory, 'prepared'), publicDirectory = join(canonical, 'public');
  for (const [name, text] of Object.entries({'one.webp':'old', 'retired.webp':'retired'})) await put(join(publicDirectory, name), text);
  for (const [name, text] of Object.entries({'one.webp':'new', 'two.webp':'two'})) await put(join(stage, 'public', name), text);
  await put(join(objectDirectory, 'inventory.json'), JSON.stringify(manifest({'one.webp':'old','retired.webp':'retired'})));
  await put(join(stage, 'prepared/inventory.json'), JSON.stringify(manifest({'one.webp':'new','two.webp':'two'})));
  for (const name of ['runtime.json', 'page.json', 'provenance.json']) {
    await put(join(outputDirectory, name), '{"version":"old"}');
    await put(join(stage, 'prepared', name), '{"version":"new"}');
  }
  await put(join(objectDirectory, 'object.json'), '{"id":"fixture","version":"old"}');
  await put(join(stage, 'object.json'), '{"id":"fixture","version":"new"}');
  await put(join(outputDirectory, 'minimaps.json'), '{"images":[{"path":"minimaps/old.webp"}]}');
  await put(join(outputDirectory, 'minimaps/old.webp'), 'old preview');
  await put(join(stage, 'prepared/minimaps.json'), '{"images":[{"path":"minimaps/new.webp"}]}');
  await put(join(stage, 'prepared/minimaps/new.webp'), 'new preview');
  return { root, canonical, args: { id: 'fixture', stage, objectDirectory, outputDirectory, publicDirectory, projectRoot: canonical } };
}

test('a late metadata failure restores images, retirements, previews, JSON and descriptor together', async t => {
  // Each rename fails once, after all earlier writes (including retirements) succeeded.
  const originalRename = fs.rename;
  let writes = 0;
  const successful = await publicationFixture();
  try {
    const spy = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => { writes++; return originalRename(...args); });
    syncBuiltinESMExports();
    try { await publishPreparedObject(successful.args); } finally { spy.mock.restore(); syncBuiltinESMExports(); }
    assert.ok(writes >= 9);
    assert.deepEqual((await readdir(successful.args.publicDirectory)).sort(), ['one.webp', 'two.webp']);
    assert.deepEqual(await readdir(join(successful.args.outputDirectory, 'minimaps')), ['new.webp']);
    assert.equal(await readFile(join(successful.args.objectDirectory, 'object.json'), 'utf8'), '{"id":"fixture","version":"new"}');
  } finally { await rm(successful.root, { recursive: true, force: true }); }
  for (let stop = 1; stop <= writes; stop++) {
    const fixture = await publicationFixture(), before = await snapshot(fixture.canonical); let call = 0;
    const mock = t.mock.method(fs, 'rename', async (...args: Parameters<typeof fs.rename>) => {
      if (++call === stop) throw new Error('injected write failure');
      return originalRename(...args);
    });
    syncBuiltinESMExports();
    try {
      await assert.rejects(publishPreparedObject(fixture.args), /injected write failure/);
      assert.deepEqual(await snapshot(fixture.canonical), before, `write ${stop}`);
    } finally { mock.mock.restore(); syncBuiltinESMExports(); await rm(fixture.root, { recursive: true, force: true }); }
  }
});

test('invalid staged metadata or missing previews fail without changing canonical files', async () => {
  for (const [path, value] of [['prepared/page.json', '{'], ['prepared/minimaps.json', '{"images":[{"path":"../source.webp"}]}']]) {
    const fixture = await publicationFixture(), before = await snapshot(fixture.canonical);
    try {
      await put(join(fixture.args.stage, path), value);
      await assert.rejects(publishPreparedObject(fixture.args));
      assert.deepEqual(await snapshot(fixture.canonical), before);
    } finally { await rm(fixture.root, { recursive: true, force: true }); }
  }
  const fixture = await publicationFixture(), before = await snapshot(fixture.canonical);
  try {
    await rm(join(fixture.args.stage, 'prepared/minimaps/new.webp'));
    await assert.rejects(publishPreparedObject(fixture.args), /ENOENT/);
    assert.deepEqual(await snapshot(fixture.canonical), before);
  } finally { await rm(fixture.root, { recursive: true, force: true }); }
});

