import { sha256 } from '@cssearth/core/node';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { decodeIsis2Qube } from '../terrestrial-layers/isis2-qube.mts';
import { fitImageControls } from './image-controls.mts';

type Pixel = readonly [number, number];
type Vec = readonly [number, number, number];
type Obj = Record<string, unknown>;
const root = process.cwd();
const obj = (v: unknown, a: string): Obj => {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) throw new TypeError(`${a} must be an object.`);
  return v as Obj;
};
const string = (v: unknown, a: string) => {
  if (typeof v !== 'string' || !v.trim()) throw new TypeError(`${a} must be text.`);
  return v;
};
const number = (v: unknown, a: string) => {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new TypeError(`${a} must be finite.`);
  return v;
};
const pixel = (v: unknown, a: string): Pixel => {
  if (!Array.isArray(v) || v.length !== 2) throw new TypeError(`${a} must be a two-value pixel.`);
  return [number(v[0], `${a}[0]`), number(v[1], `${a}[1]`)];
};
const safe = (base: string, v: unknown, a: string) => {
  const p = string(v, a);
  if (p.startsWith('/') || p.includes('\\') || p.split('/').some((x) => !x || x === '..'))
    throw new TypeError(`${a} must stay under source.`);
  const q = resolve(base, p),
    r = relative(base, q);
  if (!r || r === '..' || r.startsWith(`..${sep}`)) throw new TypeError(`${a} must stay under source.`);
  return q;
};
const pretty = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`;

interface Input {
  id: string;
  path: string;
  bytes: number;
  sha256: string;
  absolute: string;
}
interface Anchor {
  id: string;
  name: string;
  kind: 'point' | 'region';
  type: string;
  pixel: Pixel;
  minimumZoomShare: number;
  description: string;
  qualification: string;
  reference: Obj;
  maximumDistanceMeters: number;
}
interface Stage {
  controls: unknown;
  initialAffine: readonly [number, number, number, number, number, number];
}
interface Config {
  source: string;
  frame: string;
  inputs: Input[];
  stages: Stage[];
  anchors: Anchor[];
  controlId: string;
  xId: string;
  yId: string;
  zId: string;
  grid: { width: number; height: number };
  zOffsetMeters: number;
}

function config(value: unknown, source: string): Config {
  const c = obj(value, 'orthophoto landmark configuration');
  if (c.schema !== 'cssearth-orthophoto-landmarks@1') throw new TypeError('Unsupported orthophoto-landmarks schema.');
  if (!Array.isArray(c.inputs) || !c.inputs.length) throw new TypeError('Orthophoto landmarks need pinned inputs.');
  const ids = new Set<string>();
  const inputs = c.inputs.map((v, i) => {
    const x = obj(v, `input ${i}`),
      id = string(x.id, 'input id'),
      bytes = number(x.bytes, `input ${id} bytes`),
      digest = string(x.sha256, `input ${id} sha256`);
    if (ids.has(id) || !Number.isSafeInteger(bytes) || bytes < 1 || !/^[a-f0-9]{64}$/u.test(digest))
      throw new TypeError('Orthophoto inputs need distinct pinned bytes and SHA-256 values.');
    ids.add(id);
    return {
      id,
      path: string(x.path, `input ${id} path`),
      bytes,
      sha256: digest,
      absolute: safe(source, x.path, `input ${id} path`),
    };
  });
  const inputId = (v: unknown, a: string) => {
    const id = string(v, a);
    if (!ids.has(id)) throw new TypeError(`${a} must identify a pinned input.`);
    return id;
  };
  if (!Array.isArray(c.stages) || c.stages.length !== 2)
    throw new TypeError('Orthophoto landmarks need exactly two registration stages.');
  const stages = c.stages.map((value, index) => {
    const stage = obj(value, `stage ${index}`),
      a = stage.initialAffine;
    if (!Array.isArray(a) || a.length !== 6) throw new TypeError(`Stage ${index} needs a six-value initial affine.`);
    const affine = a.map((v, i) => number(v, `stage ${index} initial affine ${i}`)) as unknown as readonly [
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    if (Math.abs(affine[0] * affine[4] - affine[1] * affine[3]) < 1e-20)
      throw new TypeError(`Stage ${index} initial affine is singular.`);
    return { controls: stage.controls, initialAffine: affine };
  });
  if (!Array.isArray(c.anchors) || !c.anchors.length) throw new TypeError('Orthophoto landmarks need anchors.');
  const anchorIds = new Set<string>();
  const anchors = c.anchors.map((v, i) => {
    const x = obj(v, `anchor ${i}`),
      id = string(x.id, 'anchor id'),
      zoom = number(x.minimumZoomShare, `anchor ${id} zoom`),
      max = number(x.maximumDistanceMeters, `anchor ${id} maximum distance`),
      reference = obj(x.reference, `anchor ${id} reference`);
    string(reference.title, `anchor ${id} reference title`);
    string(reference.credit, `anchor ${id} reference credit`);
    if (
      anchorIds.has(id) ||
      !/^8\d{7}$/u.test(id) ||
      zoom < 0 ||
      zoom > 1 ||
      !(max > 0) ||
      !['point', 'region'].includes(String(x.kind)) ||
      !/^https:\/\//u.test(string(reference.url, `anchor ${id} reference URL`))
    )
      throw new TypeError(`Invalid anchor ${id}.`);
    anchorIds.add(id);
    const description = string(x.description, `anchor ${id} description`),
      qualification = string(x.qualification, `anchor ${id} qualification`);
    if (`${description} ${qualification}`.length > 400)
      throw new TypeError(`Anchor ${id} caption exceeds 400 characters.`);
    return {
      id,
      name: string(x.name, `anchor ${id} name`),
      kind: x.kind as 'point' | 'region',
      type: string(x.type, `anchor ${id} type`),
      pixel: pixel(x.pixel, `anchor ${id} pixel`),
      minimumZoomShare: zoom,
      description,
      qualification,
      reference,
      maximumDistanceMeters: max,
    };
  });
  const grid = obj(c.grid, 'orthophoto grid'),
    width = number(grid.width, 'orthophoto grid width'),
    height = number(grid.height, 'orthophoto grid height');
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1)
    throw new TypeError('Orthophoto grid dimensions must be positive integers.');
  return {
    source: string(c.source, 'source'),
    frame: string(c.frame, 'frame'),
    inputs,
    stages,
    anchors,
    controlId: inputId(c.controlId, 'control id'),
    xId: inputId(c.xId, 'x cube id'),
    yId: inputId(c.yId, 'y cube id'),
    zId: inputId(c.zId, 'z cube id'),
    grid: { width, height },
    zOffsetMeters: number(c.zOffsetMeters, 'Z offset'),
  };
}
async function bytes(c: Config) {
  const map = new Map<string, Buffer>();
  for (const i of c.inputs) {
    const b = await readFile(i.absolute);
    if (b.length !== i.bytes || sha256(b) !== i.sha256)
      throw new TypeError(`Pinned orthophoto input changed: ${i.id}.`);
    map.set(i.id, b);
  }
  return map;
}
export async function commitOrthophotoLandmarkOutputs(
  outputs: readonly { path: string; content: string }[],
  write: boolean,
) {
  for (const out of outputs) {
    if (write) {
      await mkdir(resolve(out.path, '..'), { recursive: true });
      await writeFile(out.path, out.content);
    } else {
      let prior;
      try {
        prior = await readFile(out.path, 'utf8');
      } catch {
        throw new TypeError(
          `Regenerated orthophoto landmarks are missing: ${relative(root, out.path)}. Run with --write.`,
        );
      }
      if (prior !== out.content)
        throw new TypeError(`Regenerated orthophoto landmarks differ: ${relative(root, out.path)}. Run with --write.`);
    }
  }
}
export async function projectOrthophotoLandmarks(objectId: string, write: boolean) {
  if (!/^[a-z0-9-]+$/u.test(objectId)) throw new TypeError('Object id must be lowercase letters, digits or hyphens.');
  const source = resolve(root, 'src/objects', objectId, 'source'),
    features = resolve(source, 'features'),
    c = config(JSON.parse(await readFile(resolve(features, 'image-registration.json'), 'utf8')), source),
    b = await bytes(c);
  const controlsDocument = obj(JSON.parse(b.get(c.controlId)!.toString('utf8')), 'control measurements');
  if (
    !Array.isArray(controlsDocument.stages) ||
    controlsDocument.stages.length !== c.stages.length ||
    controlsDocument.stages.some(
      (stage, index) =>
        JSON.stringify(obj(stage, `control stage ${index}`).controls) !== JSON.stringify(c.stages[index]!.controls),
    )
  )
    throw new TypeError('Pinned control measurements do not match registration stages.');
  const fits = c.stages.map((stage) => fitImageControls(stage.controls));
  if (fits.some((f) => f.model !== 'affine'))
    throw new TypeError('Orthophoto registration stages must use affine fitting.');
  const cube = (id: string) => decodeIsis2Qube(b.get(id)!, c.grid);
  const x = cube(c.xId),
    y = cube(c.yId),
    z = cube(c.zId);
  const transformStage = (point: Pixel, index: number) => {
    const [a, b, tx, cc, d, ty] = c.stages[index]!.initialAffine,
      seed: Pixel = [a * point[0] + b * point[1] + tx, cc * point[0] + d * point[1] + ty];
    return fits[index]!.transform(seed);
  };
  const anchors = c.anchors.map((a) => {
    const figure1 = transformStage(a.pixel, 0),
      native = transformStage(figure1, 1),
      sample: [number, number] = [Math.round(native[0]), Math.round(native[1])];
    if (sample[0] < 0 || sample[0] >= x.width || sample[1] < 0 || sample[1] >= x.height)
      throw new TypeError(`Anchor ${a.id} leaves the native orthophoto.`);
    const index = sample[1] * x.width + sample[0];
    if (!x.valid[index] || !y.valid[index] || !z.valid[index])
      throw new TypeError(`Anchor ${a.id} samples invalid XYZ.`);
    const point: Vec = [x.data[index]!, y.data[index]!, z.data[index]! + c.zOffsetMeters];
    return { ...a, nativePixel: native, samplePixel: sample, pointMeters: point };
  });
  const landmarks = {
    schema: 'cssearth-surface-landmarks@1',
    source: c.source,
    frame: c.frame,
    entries: anchors.map((a) => ({
      id: a.id,
      name: a.name,
      kind: a.kind,
      type: a.type,
      position: {
        pointMeters: a.pointMeters.map((v) => Number(v.toFixed(6))),
        maximumDistanceMeters: a.maximumDistanceMeters,
      },
      normal: 'surface',
      minimumZoomShare: a.minimumZoomShare,
      description: a.description,
      qualification: a.qualification,
      reference: a.reference,
    })),
  };
  const evidence = {
    schema: 'cssearth-orthophoto-landmarks-evidence@1',
    source: c.source,
    frame: c.frame,
    inputs: c.inputs.map(({ id, path, bytes, sha256 }) => ({ id, path, bytes, sha256 })),
    stages: fits.map((fit, index) => ({
      index,
      model: fit.model,
      initialAffine: c.stages[index]!.initialAffine,
      coefficients: fit.coefficients,
      stats: fit.stats,
      residuals: fit.residuals,
    })),
    anchors: anchors.map(({ id, pixel, nativePixel, samplePixel, pointMeters }) => ({
      id,
      sourcePixel: pixel,
      nativePixel,
      samplePixel,
      pointMeters,
    })),
  };
  await commitOrthophotoLandmarkOutputs(
    [
      { path: resolve(features, 'landmarks.json'), content: pretty(landmarks) },
      { path: resolve(features, 'evidence/image-landmarks.json'), content: pretty(evidence) },
    ],
    write,
  );
  return evidence;
}
async function main() {
  const [objectId, ...args] = process.argv.slice(2);
  if (!objectId || args.some((a) => a !== '--write'))
    throw new TypeError('Usage: project-orthophoto-landmarks.mts <objectId> [--write]');
  await projectOrthophotoLandmarks(objectId, args.includes('--write'));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) void main();
