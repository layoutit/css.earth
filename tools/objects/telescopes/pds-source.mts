/** Prepare a pinned OPUS PDS image for the existing pdr native-image output path. */
import { copyFile, mkdir, readFile, realpath, symlink } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { requireRecord } from '@cssearth/core';
import { PRODUCT_RECORD_SCHEMA } from '@cssearth/telescope';
import { localOutput, verifiedProduct } from './verified-product.mts';
import { OPUS_SERVICE } from './opus.mts';
import { assertPdsDependencies } from './qualify-source.mts';

export async function openPdsSource(path: string) {
  const raw = requireRecord(JSON.parse(await readFile(path, 'utf8')));
  if (raw.schema !== PRODUCT_RECORD_SCHEMA) return null;
  const source = await verifiedProduct(path), parameters = requireRecord(source.record.parameters, 'source parameters');
  if (source.record.stage !== 'telescope-archive-source' || parameters.archive !== OPUS_SERVICE) return null;
  const files = source.record.outputs.filter(output => output.path.startsWith('holdings/'));
  const images = files.filter(file => /\.img$/iu.test(file.path));
  const labels = files.filter(file => /\.(?:lbl|xml)$/iu.test(file.path));
  if (!images.length) return null;
  if (images.length !== 1) throw new Error('OPUS source needs one pinned native image for PDS output.');
  const stem = basename(images[0]!.path).replace(/\.img$/iu, '').toLowerCase();
  const matched = labels.filter(file => basename(file.path).replace(/\.(?:lbl|xml)$/iu, '').toLowerCase() === stem);
  const label = matched.length === 1 ? matched[0] : labels.length === 1 ? labels[0] : undefined;
  if (!label) throw new Error('OPUS source needs one unambiguous label for its native image.');
  return { source, path: resolve(path), files, image: images[0]!, label,
    limitations: Array.isArray(parameters.limitations) ? parameters.limitations.filter((value): value is string => typeof value === 'string') : [] };
}

/** Keep the archive tree, then provide same-directory names used by PDS3 ^STRUCTURE pointers. */
export async function preparePdsSource(source: NonNullable<Awaited<ReturnType<typeof openPdsSource>>>, directory: string) {
  // pdr materializes native arrays while decoding. Keep the handoff below a
  // conservative input budget even when source acquisition allowed a larger file.
  if (source.files.reduce((bytes, file) => bytes + file.bytes, 0) > 64 * 1024 * 1024)
    throw new RangeError('OPUS native decode exceeds the 64 MiB source budget; the original files remain pinned.');
  const root = resolve(directory), targets = new Set<string>();
  for (const file of source.files) {
    const destination = localOutput(root, file.path);
    await mkdir(dirname(destination), { recursive: true });
    // pdr resolves the label path before opening it. Keep a local label copy so
    // relative ^IMAGE and ^STRUCTURE references use the pinned staged members.
    if (file.path === source.label.path) await copyFile(localOutput(source.source.root, file.path), destination);
    else await symlink(localOutput(source.source.root, file.path), destination);
    targets.add(destination);
  }
  const label = localOutput(root, source.label.path), labelDirectory = dirname(label);
  const aliases = new Map<string, string>();
  for (const file of source.files) {
    const name = basename(file.path), original = localOutput(source.source.root, file.path);
    for (const alias of [name, name.toUpperCase()]) {
      const destination = resolve(labelDirectory, alias), prior = aliases.get(destination);
      if (prior && prior !== original) throw new Error(`OPUS support name ${alias} is ambiguous.`);
      aliases.set(destination, original);
    }
  }
  for (const [destination, original] of aliases) {
    if (targets.has(destination)) continue;
    try { await symlink(original, destination); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await realpath(destination) !== await realpath(original)) throw error;
    }
    targets.add(destination);
  }
  // The source record, not the PDS label, establishes which original files may be read.
  await assertPdsDependencies(root, { labelPath: source.label.path,
    files: source.files.map(file => ({ path: file.path, role: /\.(?:lbl|xml)$/iu.test(file.path) ? 'label' : 'science' })) });
  return { file: localOutput(root, source.image.path), directory: root,
    producing: { parameters: { observation: { decoder: 'pds-product', labelPath: source.label.path } } },
    files: source.files.map(file => ({ path: file.path })) };
}
