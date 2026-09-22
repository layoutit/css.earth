/** Acquire and qualify one exact package observation. Decoding establishes readability, never calibration or map registration. */
import { readProductScience } from './product-science.mts';
import { parseProductFacts } from './qualified-observations.mts';
import { verifyCalibrationDependencies } from './calibration-dependencies.mts';
import type { ProductFacts } from './request-satisfaction.mts';
import { sourceHeaders } from './source-transfer.mts';
import { decodeIsis3Core } from '../terrestrial-layers/isis3-raster.mts';
import { requireArray, requireRecord } from '../../sources/source-values.mts';
import { mkdir, readFile, writeFile, rename, rm, open, realpath } from 'node:fs/promises';
import { dirname, resolve, basename, relative } from 'node:path';
import { Readable } from 'node:stream';
import { withIdleTimeout, sourceCacheUrl, RUNTIME_ASSET_ORIGIN } from '../../assets/source-mirror.mts';
import { readFitsHeader, readFitsHdu, readFitsHdus, fitsImageAccessor } from '../../fits/fits.mts';
import { readRiceCompressedImage } from '../../fits/fits-rice.mts';
import { pds4ProductIdentity, pds4Blocks, pds4Elements, pds4Field } from '../pds-labels.mts';
import { pds3Keyword, pds3Values } from '../pds3-labels.mts';
import { pdsPackages } from '../astronomy-packages/pds-client.mts';
import { assertInputPins, pinFile, readProductRecord, sameRun, writeProductRecord } from '../product-record.mts';
import { inside, assertPinnedLabel, sourceCacheAddress, sourceReceipt, sourceRun, sourceRecordComplete, type SourceFile, type SourceProduct } from './source-products.mts';
import { STEREO_COR1_F16_PROFILE } from './observation-families.mts';
import { describePhysicalSphericalGrid, inspectPhysicalSphericalGrid, type SphericalGridContext } from './families/f16-spherical-grid.mts';
import { member } from './families/common.mts';

export async function acquireSourceFile(root: string, file: SourceFile): Promise<void> {
  const path = inside(root, file.path);
  if (await pinFile(path).then(() => true, () => false)) return;
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.partial`;
  const urls = [sourceCacheUrl(RUNTIME_ASSET_ORIGIN, ...sourceCacheAddress(file)), file.origin];
  const headers=await sourceHeaders(root,file);
  let last: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(url, { headers: url === file.origin ? headers : {}, signal: AbortSignal.timeout(180_000) });
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status} for ${url}`);
      const handle = await open(tmp, 'w'); let bytes = 0, mark = 10_000_000;
      try {
      for await (const part of withIdleTimeout(Readable.fromWeb(response.body as never), 30_000)) {
        const chunk = Buffer.from(part); bytes += chunk.length;
        await handle.writeFile(chunk);
        if (bytes >= mark) { process.stderr.write(`${basename(file.path)}: ${(bytes / 1e6).toFixed(1)} MB\n`); mark += 10_000_000; }
      }
      } finally { await handle.close(); }
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
  if (!arrays.some(array => (array.dimensions.length>3?2+array.dimensions.slice(2).filter(n=>n!==1).length:array.dimensions.length) === (kind === 'cube' ? 3 : 2))) throw new Error(`FITS array dimensions do not establish the declared ${kind} product kind.`);
  const structures = arrays.map(array => {
    let finite = 0, min = Infinity, max = -Infinity;
    for (let i = 0; i < array.count; i++) { const n = array.at(i); if (Number.isFinite(n)) { finite++; min = Math.min(min, n); max = Math.max(max, n); } }
    if (!finite) throw new Error('FITS image contains no finite samples.');
    return { shape: array.dimensions, elements: array.count, finite, missing: array.count - finite, minimum: min, maximum: max };
  });
  return { standard: 'FITS', header, structures };
}
export async function qualifySourceProduct(root: string, product: SourceProduct) {
  assertPinnedLabel(product);
  for (const file of product.files) await acquireSourceFile(root, file);
  let run = await sourceRun(product); const receipt = sourceReceipt(product);
  await assertInputPins(run.inputs.filter(p=>p.role!=='calibration dependency'), new Map(product.files.map(file => [file.origin, inside(root, file.path)])));
  const previous = await readProductRecord(resolve(root, receipt));
  const oldFacts = await readFile(resolve(root, `${dirname(receipt)}/decoded.json`),'utf8').then(t=>parseProductFacts(requireRecord(JSON.parse(t)).facts),()=>undefined).catch(()=>undefined);
  if(oldFacts && !await verifyCalibrationDependencies(root,oldFacts.calibrationDependencies??[]))throw new Error('Calibration dependency pin mismatch');
  if(oldFacts)run=await sourceRun(product,oldFacts.calibrationDependencies);
  if (previous && sourceRecordComplete(previous, product) && await sameRun(previous, run, path => inside(root, path))) return { product: product.files.find(file => file.role === 'science')!.path, receipt, reused: true };
  let decoded: unknown;
  let metadata: Partial<ProductFacts> = {};
  if (product.decoder === 'fits-image') {
    const science = product.files.find(file => file.role === 'science')!, bytes = await readFile(inside(root, science.path));
    decoded = inspectFits(bytes, product.identity, product.kind);
  }
  else if (product.decoder === 'isis3') {
    const bytes = await readFile(inside(root,product.files.find(f=>f.role==='science')!.path));
    const label = product.labelPath ? await readFile(inside(root,product.labelPath)) : bytes;
    const core=decodeIsis3Core(bytes, label);
    for(const [key,expected] of Object.entries(product.identity)) if(core.identity[key]!==expected) throw new Error(`ISIS identity mismatch for ${key}.`);
    if((core.bands===1?'image':'cube')!==product.kind) throw new Error('ISIS dimensions disagree with the declared kind.');
    let finite=0,min=Infinity,max=-Infinity;
    const validBands = new Array<boolean>(core.bands).fill(false);
    // ISIS Real special pixels lie below VALID_MIN4 (0xff7ffffa); retain valid zero/negative noise.
    const threshold=Buffer.from('faff7fff','hex').readFloatLE();
    for(let i=0;i<core.data.length;i++) { const n=core.data[i]; if(Number.isFinite(n)&&n>=threshold){finite++;min=Math.min(min,n);max=Math.max(max,n);} }
    if(!finite) throw new Error('ISIS core contains no finite non-special samples.');

    decoded={standard:'ISIS3',metadata:{identity:core.identity,scaling:{base:core.base,multiplier:core.multiplier}},structures:[{name:'Core',shape:core.bands===1?[core.height,core.width]:[core.bands,core.height,core.width],elements:core.data.length,finite,missing:core.data.length-finite,minimum:min,maximum:max}]};
  } else {
    const labelPath = inside(root, product.labelPath ?? product.files.find(file => file.role === 'label')!.path), label = (await readFile(labelPath)).subarray(0, 128 * 1024).toString('latin1').split(/^END\s*$/imu)[0]!;
    const pds4=pds4Blocks(label,'Product_Observational').length>0;
    for (const [key, expected] of Object.entries(product.identity)) if ((pds4 ? requireRecord(pds4ProductIdentity(label))[key] : pds3Keyword(label, key, [])) !== String(expected)) throw new Error(`PDS identity mismatch for ${key}.`);
    await assertPdsDependencies(root, product);
    decoded = (await pdsPackages({ operation: 'decode-product', labelPath })).decoded;

    const structures = requireArray(requireRecord(decoded).structures).map(value => requireRecord(value));
    if (!structures.some(s => product.kind === 'table' ? s.kind === 'table' : requireArray(s.shape).length === (product.kind === 'cube' ? 3 : 2))) throw new Error('Decoded structures do not establish the declared product kind.');
  }
  const scienceFile = product.files.find(f=>f.role==='science')!;
  metadata = await readProductScience(root,{file:scienceFile.path,format:product.decoder==='fits-image'?'fits':product.decoder==='isis3'?'isis3':'pds',target:product.target,label:product.labelPath,decoded});
  run=await sourceRun(product,metadata.calibrationDependencies);
  // Recheck after the decoder: the receipt may only attest the exact bytes it read.
  await assertInputPins(run.inputs.filter(p=>p.role!=='calibration dependency'), new Map(product.files.map(file => [file.origin, inside(root, file.path)])));
  const report = `${dirname(receipt)}/decoded.json`;
  await mkdir(resolve(root, dirname(receipt)), { recursive: true });
  await writeFile(resolve(root, report), `${JSON.stringify({ schema: 'cssearth-decoded-source@1', observation: product.id, archiveProductId: product.archiveProductId, decoded,
    facts: { target: product.target, verified: true, kind: product.kind, result: 'telescope-product', ...metadata },
    meaning: product.meaning, limitations: product.limitations, acceptance: 'Input pins and header identity agree; complete supported arrays decoded. Native metadata are validated only for supported product conventions. External calibration accuracy and scientific suitability are not independently established; measurement descriptions remain source declarations.' }, null, 2)}\n`);
  const science = product.files.find(file => file.role === 'science')!;
  const descriptorOutput: { path: string; file: string }[] = [];
  if (product.familyEvidence?.profileId === STEREO_COR1_F16_PROFILE) {
    const descriptorPath = `${dirname(receipt)}/descriptor.json`, context: SphericalGridContext = { profileId: STEREO_COR1_F16_PROFILE, frame: 'sun-carrington-cr2053', frameBasis: 'Sun-centred Cartesian axes derived from Carrington longitude, Carrington latitude and heliocentric radius for CR2053 P1.', sourceUrl: science.origin, citation: product.citation, license: 'NASA scientific data; the source manifest retains the archive credit, citation request and redistribution statement.', quantity: 'electron number density', unit: product.units, hdu: 0 };
    const sciencePath = inside(root, science.path), bytes = await readFile(sciencePath), inspection = await inspectPhysicalSphericalGrid({ path: sciencePath }, context);
    const value = describePhysicalSphericalGrid({ id: product.id, target: product.target, member: member('electron-density-fits', relative(dirname(resolve(root, descriptorPath)), sciencePath), 'science', bytes, 'application/fits'), context, inspection, producingRecord: receipt });
    await writeFile(resolve(root, descriptorPath), `${JSON.stringify(value, null, 2)}\n`); descriptorOutput.push({ path: descriptorPath, file: resolve(root, descriptorPath) });
  }
  await writeProductRecord(resolve(root, receipt), run, [...product.files.map(file => ({ path: file.path, file: inside(root, file.path) })), { path: report, file: resolve(root, report) }, ...descriptorOutput, ...(metadata.calibrationDependencies??[]).flatMap(d=>d.file?[{path:d.file,file:resolve(root,d.file)}]:[])],
    [{ kind: 'archive-origin', receipt, product: science.path, establishes: 'Manifest-pinned archive bytes, matching header identity and complete supported numeric structure decoding. No local recalibration, archive comparison or surface registration is claimed.' }]);
  return { product: science.path, receipt, reused: false };
}

/** Check every detached pointer before pdr can resolve files outside the pinned dependency set. */
export async function assertPdsDependencies(root: string, product: SourceProduct): Promise<void> {
  const pending = product.files.filter(file => file.role === 'label' || file.path === product.labelPath), visited = new Set<string>();
  while (pending.length) {
    const file = pending.shift()!; if (visited.has(file.path)) continue; visited.add(file.path);
    const labelBytes = await readFile(inside(root, file.path));
    const label = labelBytes.subarray(0, 128 * 1024).toString('latin1').split(/^END\s*$/imu)[0]!;
    if (pds4Blocks(label,'Product_Observational').length) {
      for (const entry of pds4Elements(label,'file_name')) {
        const path=resolve(dirname(inside(root,file.path)),entry.content.trim());
        if(!product.files.some(f=>inside(root,f.path)===path))throw new Error(`Unpinned PDS4 dependency ${entry.content}.`);
      }
      continue;
    }
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
