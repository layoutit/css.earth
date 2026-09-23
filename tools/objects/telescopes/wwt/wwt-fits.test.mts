import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
import { acquireWwtFits } from './wwt-fits.mts';
import { listArtifactOutputs } from '../artifact-outputs.mts';
import { exportOutput } from '../outputs.mts';

const test = sourceTest();
const sha = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const card = (key: string, value: string): string => `${key.padEnd(8)}= ${value}`.padEnd(80);
const fits = (): Buffer => {
  const header = [card('SIMPLE', 'T'), card('BITPIX', '-32'), card('NAXIS', '2'), card('NAXIS1', '256'), card('NAXIS2', '256'), 'END'.padEnd(80)].join('').padEnd(2880);
  const bytes = Buffer.alloc(2880 + 256 * 256 * 4);
  bytes.write(header, 0, 'ascii');
  for (let i = 0; i < 256 * 256; i++) bytes.writeFloatBE(i === 0 ? 42.5 : Number.NaN, 2880 + i * 4);
  return bytes;
};

test('WWT FITS keeps original numeric bytes and reports missing scientific metadata', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'wwt-fits-test-'));
  try {
    const wtml = Buffer.from('<Folder/>'), bytes = fits(), snapshot = resolve(root, 'catalog.json');
    await writeFile(resolve(root, 'collection.wtml'), wtml);
    await writeFile(snapshot, JSON.stringify({ schema: 'cssearth-wwt-fits-catalog@1',
      source: { url: 'https://example.org/collection.wtml', file: 'collection.wtml', sha256: sha(wtml), parser: 'wwt-data-formats@0.18.1' },
      imagesets: [{ name: 'Science', fileType: '.fits', dataSetType: 'Sky', projection: 'Tan',
        urlTemplate: 'http://example.org/{1}/{3}/{3}_{2}.fits', position: { tileLevels: 1, centerXDegrees: 0, centerYDegrees: 0 } }] }));
    const requested: string[] = [], result = await acquireWwtFits(snapshot, 'Science', 0, 0, 0, resolve(root, 'result'), async url => {
      requested.push(url); return new Response(new Uint8Array(bytes));
    });
    assert.deepEqual(requested, ['https://example.org/0/0/0_0.fits']);
    assert.equal(sha(await readFile(result.source)), sha(bytes));
    assert.equal(result.status, 'unresolved');
    assert.match(result.limitations.join(' '), /science unit/u);
    assert.match(result.limitations.join(' '), /celestial WCS/u);
    const values = await readFile(result.values, 'utf8');
    assert.match(values, /^x_pixel,y_pixel,value,standard_deviation\r?\n0,0,42\.5,/u);
    const receipt = JSON.parse(await readFile(result.receipt, 'utf8')) as { inputs: { identity: string; sha256: string }[]; outputs: { path: string; sha256: string }[] };
    assert.equal(receipt.inputs.find(item => item.identity.endsWith('.fits'))?.sha256, sha(bytes));
    assert.equal(receipt.outputs.find(item => item.path === 'source.fits')?.sha256, sha(bytes));
    const offered=await listArtifactOutputs(result.receipt);
    assert.equal(offered.artifact,'telescope-wwt-fits');
    assert.ok(offered.outputs.some(choice=>choice.kind==='image'&&choice.hdu===0&&choice.available));
    assert.ok(offered.issues?.some(issue=>issue.includes('celestial WCS')));
    const exported=await exportOutput(result.receipt,{kind:'image',hdu:0},resolve(root,'exported'));
    const produced=JSON.parse(await readFile(exported.receipt,'utf8')) as {stage:string;inputs:{role:string;sha256:string}[]};
    assert.equal(produced.stage,'telescope-source-output');
    assert.equal(produced.inputs.find(input=>input.role==='FITS source')?.sha256,sha(bytes));
    assert.equal((await listArtifactOutputs(exported.receipt)).terminal,true);
    // Saved WWT receipts from before the shared FITS handoff retain the same route.
    const old=JSON.parse(await readFile(result.receipt,'utf8')) as {parameters:{fitsSource?:unknown}};
    delete old.parameters.fitsSource;await writeFile(result.receipt,JSON.stringify(old));
    assert.ok((await listArtifactOutputs(result.receipt)).outputs.some(choice=>choice.kind==='image'&&choice.available));
    await writeFile(result.source,'changed');
    await assert.rejects(listArtifactOutputs(result.receipt),/pins changed/u);
    await assert.rejects(acquireWwtFits(snapshot, 'Science', 1, 2, 0, resolve(root, 'outside'), async () => new Response(new Uint8Array(bytes))), /outside this level/u);
    await writeFile(resolve(root, 'collection.wtml'), 'changed');
    await assert.rejects(acquireWwtFits(snapshot, 'Science', 0, 0, 0, resolve(root, 'changed'), async () => new Response(new Uint8Array(bytes))), /differs from the pinned catalog/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
