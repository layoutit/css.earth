/** Obtain restricted getsf directly from its author, locally, for the documented research benchmark. */
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { digest } from '@cssearth/nebula-reconstruction/methods/getsf/benchmark-products';
import { decodeFits } from '@cssearth/fits';
import { encodeFits } from '@cssearth/fits/node';

const [destination] = process.argv.slice(2);
if (!destination) throw new Error('Usage: getsf-install <ignored-local-directory>. Read docs/getsf.md user-agreement restrictions first.');
const root = resolve(destination), source = resolve(root, 'source'), bin = resolve(root, 'bin');
await mkdir(source, { recursive: true });
const sources = {
  getsf: { name: 'getsf.v260706.zip', url: 'https://irfu.cea.fr/Pisp/alexander.menshchikov/getsf.v260706.zip',
    sha256: '70725784d898a2d49c11ebc37cdaa94c07a6cad830215c6fdfdb32b23255c99b' },
  cfitsio: { name: 'cfitsio-4.7.0.tar.gz', url: 'https://heasarc.gsfc.nasa.gov/FTP/software/fitsio/c/cfitsio-4.7.0.tar.gz',
    sha256: 'ce573bbea8e75b429f8c3d3e86498741ba3dc9628a1530d2f65268397ad059e8' },
};
for (const entry of Object.values(sources)) {
  const path = resolve(source, entry.name);
  let bytes: Buffer;
  try { bytes = await readFile(path); } catch {
    const response = await fetch(entry.url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Source download failed: ${response.status} ${entry.url}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (digest(bytes) !== entry.sha256) throw new Error(`Source checksum differs: ${entry.name}`);
  await writeFile(path, bytes);
}
const env = { ...process.env, GETSF_HOME: source, GETSF_BIN: bin };
async function command(name: string, args: string[], cwd: string, input = '', allowedCodes = [0]): Promise<string> {
  console.log('getsf installation:', name, ...args);
  return new Promise((done, reject) => {
    const child = spawn(name, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', chunk => { text += chunk.toString(); });
    child.stderr.on('data', chunk => { text += chunk.toString(); });
    child.once('error', reject);
    child.once('close', async code => {
      await writeFile(resolve(root, 'installation.log'), `\n$ ${name} ${args.join(' ')}\n${text}`, { flag: 'a' });
      allowedCodes.includes(code ?? -1) ? done(text) : reject(new Error(`Installation failed: ${name}, exit${code}. See installation.log.`));
    });
    child.stdin.end(input);
  });
}
const compiler = (await command('gfortran', ['--version'], root)).split('\n')[0];
await command('unzip', ['-q', '-o', resolve(source, sources.getsf.name), '-d', source], root);
await command('tar', ['-xzf', resolve(source, sources.cfitsio.name), '-C', source], root);
const fits = resolve(source, 'cfitsio-4.7.0');
await command('./configure', ['--disable-curl', '--enable-static', '--disable-shared'], fits);
await command('make', ['-j8'], fits);
await copyFile(resolve(fits, '.libs/libcfitsio.a'), resolve(source, 'libcfitsio.a'));
await command('./installg', ['gfortran'], resolve(source, 'v260706'), '\n');
const binaries: Record<string, string> = {};
for (const entry of await readdir(bin, { withFileTypes: true }))
  if (entry.isFile()) binaries[entry.name] = digest(await readFile(resolve(bin, entry.name)));
for (const required of ['getsf', 'fftconv', 'extractx', 'cleanbg', 'sfinder', 'modfits'])
  if (!binaries[required]) throw new Error(`Installer did not create ${required}.`);
// gfortran16 rejects a legacy format in the optional no-argument help banner.
// Verify the actual noninteractive path used by getsf, with a real FITS side effect.
const probeSamples = new Float32Array([.125, .25, .5, 1]);
const probeInput = resolve(root, 'installation-probe-input'), probeOutput = resolve(root, 'installation-probe-output');
await writeFile(`${probeInput}.fits`, encodeFits(probeSamples, 2, 2, { BUNIT: 'MJy/sr',
  CTYPE1: 'RA---TAN', CTYPE2: 'DEC--TAN', CDELT1: -.001, CDELT2: .001,
  CRPIX1: 1, CRPIX2: 1, CRVAL1: 0, CRVAL2: 0, RA: 0, DEC: 0, CROTA1: 0, CROTA2: 0 }));
await command(resolve(bin, 'modfits'), ['multiply', '1', probeInput, '-o', probeOutput, '-verb0'], root);
const probeResult = decodeFits(await readFile(`${probeOutput}.fits`));
if (probeResult.width !== 2 || probeResult.height !== 2 || probeResult.values.some((value, p) => value !== probeSamples[p]))
  throw new Error('Installed FITS utility did not preserve test samples.');
const receipt = { schema: 'cssearth-getsf-install@1', software: { ...sources.getsf, name: 'getsf', version: '260706',
  author: 'Alexander Men’shchikov', manualSourcePatches: false, sourceArchiveUnmodified: true,
  upstreamInstallerTransforms: { description: 'The author installer rewrites tools.for portability declarations and replaces its bundled precompiled tools.a.',
    toolsForAfterInstallSha256: digest(await readFile(resolve(source, 'v260706/+tools_lib/tools.for'))) } },
  cfitsio: { version: '4.7.0', ...sources.cfitsio,
    build: ['./configure --disable-curl --enable-static --disable-shared', 'make -j8'],
    staticLibrarySha256: digest(await readFile(resolve(source, 'libcfitsio.a'))) },
  compiler, platform: (await command('uname', ['-a'], root)).trim(), binaries,
  getsfBuild: ['GETSF_HOME=<source> GETSF_BIN=<bin> ./installg gfortran'],
  verification: { operation: 'modfits multiply1, verbosity0', inputSha256: digest(await readFile(`${probeInput}.fits`)),
    outputSha256: digest(await readFile(`${probeOutput}.fits`)), exactPixelEquality: true,
    limitation: 'The optional no-argument help banner uses a legacy Fortran format rejected by gfortran16; noninteractive processing uses verbosity0.' },
  optionalDependencies: { SWarp: 'Not used: input is already a common2D grid.', wcstools: 'Not required: pixel catalog only.', highlight: 'Optional log coloring only.' },
  license: 'Author’s restricted agreement: research, education, non-profit and non-military purposes only; commercial use needs written permission. Software stays local and ignored.' };
await writeFile(resolve(root, 'install-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log('GETSF_INSTALL_COMPLETE', resolve(root, 'install-receipt.json'));
