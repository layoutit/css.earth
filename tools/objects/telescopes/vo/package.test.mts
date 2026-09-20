import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { extractVoPackage } from './package.mts';

const PYTHON = String.raw`
import io, sys, tarfile, zipfile
kind, target, mode = sys.argv[1:]
def card(key, value): return f'{key:<8}= {value:>20}'.encode() + b' ' * 50
header = card('SIMPLE', 'T') + card('BITPIX', '8') + card('NAXIS', '2') + card('NAXIS1', '1') + card('NAXIS2', '1') + b'END' + b' ' * 77
fits = header + b' ' * (2880 - len(header)) + b'\x00' + b' ' * 2879
entries = [('science.fits', fits), ('labels/product.lbl', b'^IMAGE = (../science.fits, 1)\n'), ('labels/product.xml', b'<Product_Observational xmlns="urn:pds"><File><file_name>../science.fits</file_name></File></Product_Observational>'), ('labels/format.fmt', b'OBJECT = COLUMN\n')]
if mode == 'two': entries.append(('other.fit', fits))
if mode == 'missing-label': entries[1] = ('labels/product.lbl', b'^IMAGE = "missing.fits"\n')
if mode == 'missing-fmt': entries[-1] = ('labels/format.fmt', b'^STRUCTURE = missing.fmt\n')
if mode == 'large': entries = [('science.fits', fits + b'x' * 4096)]
if mode == 'traversal': entries = [('../escape.fits', fits)]
if mode == 'duplicate': entries = [('science.fits', fits), ('./science.fits', fits)]
if kind == 'zip':
  with zipfile.ZipFile(target, 'w') as archive:
    for name, value in entries:
      item = zipfile.ZipInfo(name)
      if mode == 'link': item.external_attr = 0o120777 << 16
      archive.writestr(item, value)
else:
  with tarfile.open(target, 'w') as archive:
    for name, value in entries:
      item = tarfile.TarInfo(name)
      if mode == 'link': item.type = tarfile.SYMTYPE; item.linkname = 'science.fits'; archive.addfile(item)
      else: item.size = len(value); archive.addfile(item, io.BytesIO(value))
`;

async function workspace(): Promise<{ root: string; staging: string }> {
  const root = await mkdtemp(resolve(tmpdir(), 'vo-package-')), staging = resolve(root, 'staging');
  await (await import('node:fs/promises')).mkdir(staging);
  return { root, staging };
}
function archive(root: string, kind: 'zip' | 'tar', mode = 'good'): string {
  const path = resolve(root, `package.${kind === 'zip' ? 'zip' : 'tar'}`);
  execFileSync('python3', ['-c', PYTHON, kind, path, mode]);
  return path;
}

for (const kind of ['zip', 'tar'] as const) test(`${kind} package stages its FITS image and companions with pins`, async () => {
  const { root, staging } = await workspace();
  try {
    const result = await extractVoPackage(archive(root, kind), staging, { expandedBytes: 100_000, members: 10 });
    assert.equal(result.format, kind); assert.equal(result.science, 'science.fits'); assert.equal(result.members.length, 4);
    assert.equal((await readFile(resolve(staging, 'members', result.science))).subarray(0, 6).toString(), 'SIMPLE');
    assert.ok(result.members.every(member => /^[a-f0-9]{64}$/u.test(member.sha256)));
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const mode of ['missing-label', 'missing-fmt', 'large', 'traversal', 'duplicate'] as const) test(`unsafe ${mode} package leaves staging empty`, async () => {
  const { root, staging } = await workspace();
  try {
    await assert.rejects(extractVoPackage(archive(root, 'zip', mode), staging, { expandedBytes: mode === 'large' ? 4000 : 100_000, members: 10 }));
    assert.deepEqual(await readdir(staging), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a compound package retains multiple FITS members without choosing one', async () => {
  const { root, staging } = await workspace();
  try {
    const result = await extractVoPackage(archive(root, 'zip', 'two'), staging, { expandedBytes: 100_000, members: 10 });
    assert.equal(result.science, null); assert.deepEqual(result.fitsMembers, ['other.fit', 'science.fits']);
    assert.equal((await readFile(resolve(staging, 'members', 'other.fit'))).subarray(0, 6).toString(), 'SIMPLE');
  } finally { await rm(root, { recursive: true, force: true }); }
});

for (const kind of ['zip', 'tar'] as const) test(`${kind} links and truncated archives never publish`, async () => {
  const { root, staging } = await workspace();
  try {
    await assert.rejects(extractVoPackage(archive(root, kind, 'link'), staging, { expandedBytes: 100_000, members: 10 }), /link|regular/u);
    assert.deepEqual(await readdir(staging), []);
    const corrupt = archive(root, kind);
    const bytes = await readFile(corrupt);
    await (await import('node:fs/promises')).writeFile(corrupt, bytes.subarray(0, Math.min(bytes.length - 1, 612)));
    await assert.rejects(extractVoPackage(corrupt, staging, { expandedBytes: 100_000, members: 10 }));
    assert.deepEqual(await readdir(staging), []);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('member count and caller-provided destination policy are enforced', async () => {
  const { root, staging } = await workspace();
  try {
    const input = archive(root, 'tar');
    await assert.rejects(extractVoPackage(input, staging, { expandedBytes: 100_000, members: 2 }), /member limit/u);
    await assert.deepEqual(await readdir(staging), []);
    await extractVoPackage(input, staging, { expandedBytes: 100_000, members: 10 });
    await assert.rejects(extractVoPackage(input, staging, { expandedBytes: 100_000, members: 10 }), /already contains/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});
