import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { shaSearch, archiveUrl, listArchiveDirectory } from '../../src/archives/spitzer/archive.mts';
import { requireRecord, requireArray, requireString } from '@cssearth/core';
import { readFitsHdus, readFitsImage, skyProjection } from '@cssearth/fits';

const root = resolve('.local/infrared/spitzer');
const save = async (name: string, value: unknown) => writeFile(resolve(root, name), JSON.stringify(value, null, 2));
const aors = [8798976, 8798720, 6526720];
interface Product { aor: number; channel: number; role: string; file: string; url: string; bytes: number }
if (process.argv.includes('--discover')) {
  for (const aorKey of aors) {
    const aor = await shaSearch({ id: 'aorByRequestID', aorKey: String(aorKey) }, { timeoutMs: 20000, attempts: 1 });
    const products = await shaSearch({ id: 'pbcdByRequestID', aorKey: String(aorKey) }, { timeoutMs: 20000, attempts: 1 });
    await save(`sha-${aorKey}-metadata.json`, { aor, products });
    console.log(JSON.stringify({ aorKey, aor, products: products.map(row => ({ name: row.externalname, url: row.heritagefilename && archiveUrl(row.heritagefilename),
      channel: row.channum, wavelength: row.wavelength, width: row.naxis1, height: row.naxis2, bytes: row.filesize })) }));
  }
}
if (process.argv.includes('--download-native')) {
  const products: Product[] = [];
  let totalBytes = 0;
  for (const aor of aors.slice(0, 2)) for (const channel of [1, 2]) {
    const listing = requireRecord(JSON.parse(await readFile(resolve(root, `sha-${aor}-ch${channel}-file-list.json`), 'utf8')));
    const directory = requireString(listing.directory), names = requireArray(listing.files).map(v => requireString(v));
    for (const role of ['maic', 'munc', 'mcov']) {
      const candidates = names.filter(name => name.endsWith(`_${role}.fits`));
      if (candidates.length !== 1) throw new Error(`AOR${aor} channel${channel} has no unique ${role} file.`);
      const name = candidates[0]!, url = directory + name;
      const file = aor === 8798976 && role === 'maic' ? `pilot-mips${channel === 1 ? 24 : 70}-a.fits`
        : `aor${aor}-mips${channel === 1 ? 24 : 70}-${role}.fits`;
      let exists = false;
      try { await stat(resolve(root, file)); exists = true; } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
      }
      if (!exists) {
        const response = await fetch(url, { signal: AbortSignal.timeout(90000) });
        if (!response.ok || !response.body) throw new Error(`${response.status}: ${url}`);
        const chunks: Uint8Array[] = []; let bytes = 0;
        for await (const chunk of response.body) {
          bytes += chunk.byteLength;
          if (totalBytes + bytes > 200000000) throw new Error('Spitzer science-byte bound exceeded.');
          chunks.push(chunk);
        }
        const output = Buffer.concat(chunks);
        if (!output.subarray(0, 8).equals(Buffer.from('SIMPLE  '))) throw new Error(`Not a FITS file: ${url}`);
        readFitsHdus(output); await writeFile(resolve(root, file), output);
      }
      const bytes = (await stat(resolve(root, file))).size;
      totalBytes += bytes;
      if (totalBytes > 200000000) throw new Error('Spitzer science-byte bound exceeded.');
      products.push({ aor, channel, role, file, url, bytes });
      await save('products.json', { schema: 'pleiades-spitzer-native-products@1', totalBytes, products });
      console.log('SPITZER_NATIVE_READY', JSON.stringify(products.at(-1)));
    }
  }
}
if (process.argv.includes('--list')) {
  for (const aor of aors.slice(0, 2)) {
    const value = requireRecord(JSON.parse(await readFile(resolve(root, `sha-${aor}-metadata.json`), 'utf8')));
    for (const raw of requireArray(value.products)) {
      const row = requireRecord(raw); if (!['1', '2'].includes(String(row.channum))) continue;
      const url = archiveUrl(requireString(row.heritagefilename));
      const directory = url.slice(0, url.lastIndexOf('/') + 1), files = await listArchiveDirectory(directory);
      await save(`sha-${aor}-ch${row.channum}-file-list.json`, { directory, files }); console.log(JSON.stringify({ directory, files }));
    }
  }
}
if (process.argv.includes('--inspect')) {
  for (const arg of process.argv.slice(process.argv.indexOf('--inspect') + 1)) {
    const path = resolve(root, arg), bytes = await readFile(path), hdus = readFitsHdus(bytes);
    const records = hdus.map((hdu, index) => {
      const header = hdu.header, width = Number(header.NAXIS1), height = Number(header.NAXIS2);
      if (!(width > 0 && height > 0)) return { index, header };
      const image = readFitsImage(bytes, { start: index ? hdus[index - 1]!.nextOffset : 0 });
      const finite = Array.from(image.values).filter(Number.isFinite).sort((a, b) => a - b);
      const quantile = (f: number) => finite[Math.floor((finite.length - 1) * f)] ?? null;
      const projection = skyProjection(header);
      return { index, header, width, height, finitePixels: finite.length, positivePixels: finite.filter(v => v > 0).length,
        totalPixels: width * height, statistics: { min: finite[0] ?? null, p05: quantile(.05), median: quantile(.5), p95: quantile(.95), max: finite.at(-1) ?? null },
        centerSky: projection.skyOf((width - 1) / 2, (height - 1) / 2),
        cornerSky: [[0, 0], [width - 1, 0], [width - 1, height - 1], [0, height - 1]].map(([x, y]) => projection.skyOf(x!, y!)) };
    });
    await save(`${arg}.inspection.json`, { path, bytes: (await stat(path)).size, hdus: records });
    console.log(JSON.stringify({ path, hdus: records.map(({ header, ...rest }) => ({ ...rest, identity: {
      AORKEY: header.AORKEY, INSTRUME: header.INSTRUME, CHNLNUM: header.CHNLNUM, BUNIT: header.BUNIT, CREATOR: header.CREATOR } })) }));
  }
}
