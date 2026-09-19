/** Acquire and qualify one exact package observation. Decoding establishes readability, never calibration or map registration. */
import { mkdir, readFile, writeFile, rename, rm, open, realpath } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { Readable } from 'node:stream';
import { withIdleTimeout, sourceCacheUrl, RUNTIME_ASSET_ORIGIN } from '../../source-mirror.mts';
import { readFitsHeader, readFitsHdu, readFitsHdus, fitsImageAccessor } from '../../fits.mts';
import { readRiceCompressedImage } from '../../fits-rice.mts';
import { pds3Keyword, pds3Values } from '../pds3-labels.mts';
import { pdsPackages } from '../astronomy-packages/pds-client.mts';
import { assertInputPins, pinFile, readProductRecord, sameRun, writeProductRecord } from '../product-record.mts';
import { inside, sourceReceipt, sourceRun, sourceRecordComplete, type SourceFile, type SourceProduct } from './source-products.mts';

export async function acquireSourceFile(root: string, file: SourceFile): Promise<void> {
  const path = inside(root, file.path), existing = await pinFile(path).catch(() => null);
  if (existing) {
    if (existing.bytes !== file.bytes || existing.sha256 !== file.sha256) throw new Error(`${file.path} differs from its manifest pin.`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.partial`;
  const urls = [sourceCacheUrl(RUNTIME_ASSET_ORIGIN, file.sha256, basename(file.path)), file.origin];
  let last: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} for ${url}`);
      const handle = await open(tmp, 'w'); let bytes = 0, mark = 10_000_000;
      try {
      for await (const part of withIdleTimeout(Readable.fromWeb(response.body as never), 30_000)) {
        const chunk = Buffer.from(part); bytes += chunk.length;
        if (bytes > file.bytes) throw new Error(`${file.path} exceeds its pinned byte count.`);
        await handle.writeFile(chunk);
        if (bytes >= mark) { process.stderr.write(`${basename(file.path)}: ${(bytes / 1e6).toFixed(1)} / ${(file.bytes / 1e6).toFixed(1)} MB\n`); mark += 10_000_000; }
      }
      } finally { await handle.close(); }
      const found = await pinFile(tmp);
      if (found.bytes !== file.bytes || found.sha256 !== file.sha256) throw new Error(`${file.path}: downloaded bytes do not match the manifest.`);
      await rename(tmp, path); return;
    } catch (error) { last = error; await rm(tmp, { force: true }); }
  }
  throw last;
}
export function inspectFits(bytes: Buffer, identity: SourceProduct['identity'], kind: SourceProduct['kind'] = 'image') {
  const primary = readFitsHdu(bytes);
  const compressed = primary.count === 0 && primary.nextOffset < bytes.length && readFitsHeader(bytes, primary.nextOffset).header.ZCMPTYPE === 'RICE_1';
  const rice = compressed ? readRiceCompressedImage(bytes) : undefined;
  const hdus = rice ? [] : readFitsHdus(bytes), header = rice ? { ...primary.header, ...rice.header } : primary.header;
  for (const [key, expected] of Object.entries(identity)) if (header[key] !== expected) throw new Error(`FITS identity mismatch for ${key}: expected ${expected}, got ${header[key]}.`);
  const arrays = rice ? [{ dimensions: [rice.width, rice.height], count: rice.values.length, at: (i: number) => rice.values[i]! }]
    : hdus.filter(hdu => hdu.count && hdu.header.XTENSION !== 'BINTABLE' && hdu.header.XTENSION !== 'TABLE').map(hdu => ({ dimensions: hdu.dimensions, count: hdu.count, at: fitsImageAccessor(bytes, hdu) }));
  if (!arrays.length) throw new Error('FITS product contains no supported image.');
  if (!arrays.some(array => array.dimensions.length === (kind === 'cube' ? 3 : 2))) throw new Error(`FITS array dimensions do not establish the declared ${kind} product kind.`);
  const structures = arrays.map(array => {
    let finite = 0, min = Infinity, max = -Infinity;
    for (let i = 0; i < array.count; i++) { const n = array.at(i); if (Number.isFinite(n)) { finite++; min = Math.min(min, n); max = Math.max(max, n); } }
    if (!finite) throw new Error('FITS image contains no finite samples.');
    return { shape: array.dimensions, elements: array.count, finite, missing: array.count - finite, minimum: min, maximum: max };
  });
  return { standard: 'FITS', header, structures };
}
export async function qualifySourceProduct(root: string, product: SourceProduct) {
  for (const file of product.files) await acquireSourceFile(root, file);
  const run = await sourceRun(product), receipt = sourceReceipt(product);
  await assertInputPins(run.inputs, new Map(product.files.map(file => [file.origin, inside(root, file.path)])));
  const previous = await readProductRecord(resolve(root, receipt));
  if (previous && sourceRecordComplete(previous, product) && await sameRun(previous, run, path => inside(root, path))) return { product: product.files.find(file => file.role === 'science')!.path, receipt, reused: true };
  let decoded: unknown;
  if (product.decoder === 'fits-image') decoded = inspectFits(await readFile(inside(root, product.files.find(file => file.role === 'science')!.path)), product.identity, product.kind);
  else {
    const labelPath = inside(root, product.files.find(file => file.role === 'label')!.path), label = await readFile(labelPath, 'utf8');
    for (const [key, expected] of Object.entries(product.identity)) if (pds3Keyword(label, key, []) !== String(expected)) throw new Error(`PDS identity mismatch for ${key}.`);
    await assertPdsDependencies(root, product);
    decoded = (await pdsPackages({ operation: 'decode-product', labelPath })).decoded;
  }
  // Recheck after the decoder: the receipt may only attest the exact bytes it read.
  await assertInputPins(run.inputs, new Map(product.files.map(file => [file.origin, inside(root, file.path)])));
  const report = `${dirname(receipt)}/decoded.json`;
  await mkdir(resolve(root, dirname(receipt)), { recursive: true });
  await writeFile(resolve(root, report), `${JSON.stringify({ schema: 'cssearth-decoded-source@1', observation: product.id, archiveProductId: product.archiveProductId, decoded,
    facts: { target: product.target, verified: true, kind: product.kind, result: 'telescope-product' },
    meaning: product.meaning, limitations: product.limitations, acceptance: 'Input pins and header identity agree; complete supported arrays decoded. Calibration accuracy and scientific suitability are not established; measurement descriptions are source declarations.' }, null, 2)}\n`);
  const science = product.files.find(file => file.role === 'science')!;
  await writeProductRecord(resolve(root, receipt), run, [...product.files.map(file => ({ path: file.path, file: inside(root, file.path) })), { path: report, file: resolve(root, report) }],
    [{ kind: 'archive-origin', receipt, product: science.path, establishes: 'Manifest-pinned archive bytes, matching header identity and complete supported image decoding. No local recalibration, archive comparison or surface registration is claimed.' }]);
  return { product: science.path, receipt, reused: false };
}

/** Check every detached pointer before pdr can resolve files outside the pinned dependency set. */
export async function assertPdsDependencies(root: string, product: SourceProduct): Promise<void> {
  const pending = product.files.filter(file => file.role === 'label'), visited = new Set<string>();
  while (pending.length) {
    const file = pending.shift()!; if (visited.has(file.path)) continue; visited.add(file.path);
    const label = await readFile(inside(root, file.path), 'utf8');
    const keys = [...new Set([...label.matchAll(/^\s*(\^[A-Z][A-Z0-9_:]*)\s*=/gmi)].map(match => match[1]!))];
    for (const key of keys) {
      // No scope means nested format pointers are included; ambiguous duplicate keys fail closed in the label parser.
      const pointer = pds3Values(label, key), name = pointer?.[0];
      if (!name) throw new Error(`Unreadable PDS dependency ${key}.`);
      if (/^\d+(?:\s*<BYTES>)?$/u.test(name)) continue; // attached data
      const path = resolve(dirname(inside(root, file.path)), name);
      const actual = await realpath(path).catch(() => undefined);
      const matches = [];
      for (const entry of product.files) if (actual ? await realpath(inside(root, entry.path)) === actual : inside(root, entry.path).toLowerCase() === path.toLowerCase()) matches.push(entry);
      const dependency = matches.length === 1 ? matches[0] : undefined;
      if (!dependency) throw new Error(`Unpinned PDS dependency ${name}. Add it to this observation's manifest inputs.`);
      if (/\.(fmt|lbl)$/iu.test(name)) pending.push(dependency);
    }
  }
}
