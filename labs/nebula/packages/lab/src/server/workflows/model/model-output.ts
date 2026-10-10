/** What `model <id> --method <m>` leaves in `src/objects/<id>/.local/lab/model/`: `<method>.json` (this contract) and the
 * method's own files (a surface's STL and recipe block, a fit image). The Model tab draws a result's outlines and
 * points over its image; nothing here is committed or baked until a later step writes the recipe. */
import { isRecord } from '@cssearth/core';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { labDirectory } from '../plates/working-copy.ts';
import { MODEL_METHODS, type ModelMethod } from '../research/research.ts';

export const LAB_MODEL_SCHEMA = 'cssearth-lab-model@1';
export interface ModelOutline { id: string; label: string; kind: 'envelope' | 'wall' | 'plate' | 'ellipse' | 'outline'; closed: boolean; points: [number, number][] }
export interface ModelPoint { x: number; y: number; kmS: number }
export interface ModelSurface { kind: string; label: string; record?: string; values: Record<string, number | string> }
export interface LabModel {
  schema: typeof LAB_MODEL_SCHEMA; id: string; method: ModelMethod; createdAt: string;
  /** The picture the outlines are drawn on, a repository path, and its size in pixels: outlines are in its pixels. */
  image: { path: string; width: number; height: number; label: string };
  outlines: ModelOutline[]; points: ModelPoint[]; surfaces: ModelSurface[];
  metrics: Record<string, number | string | null>;
  /** Files the method wrote beside its result, repository paths. */
  files: string[];
  /** Short limits of this result: assumptions taken and work deferred. */
  notes: string[];
}

export const modelDirectory = (root: string, id: string) => resolve(labDirectory(root, id), 'model');
/** One result per method: `model/<method>.json`, so the Model tab compares methods without rerunning them. */
export const modelPath = (root: string, id: string, method: ModelMethod) => resolve(modelDirectory(root, id), `${method}.json`);

const finite = (value: unknown, name: string) => { if (typeof value !== 'number' || !Number.isFinite(value)) throw new TypeError(`model result ${name} must be a finite number.`); return value; };
const text = (value: unknown, name: string) => { if (typeof value !== 'string' || !value) throw new TypeError(`model result ${name} must be text.`); return value; };
const pair = (value: unknown, name: string): [number, number] => {
  if (!Array.isArray(value) || value.length !== 2) throw new TypeError(`model result ${name} must be an [x, y] pair.`);
  return [finite(value[0], name), finite(value[1], name)];
};
export function readLabModel(value: unknown): LabModel {
  if (!isRecord(value) || value.schema !== LAB_MODEL_SCHEMA) throw new TypeError(`Expected a ${LAB_MODEL_SCHEMA} result.`);
  if (!(MODEL_METHODS as readonly unknown[]).includes(value.method)) throw new TypeError(`model result method is one of ${MODEL_METHODS.join(', ')}.`);
  const image = value.image;
  if (!isRecord(image)) throw new TypeError('model result needs its image.');
  const list = (key: string) => { const items = value[key]; if (!Array.isArray(items)) throw new TypeError(`model result ${key} must be a list.`); return items as unknown[]; };
  return { schema: LAB_MODEL_SCHEMA, id: text(value.id, 'id'), method: value.method as ModelMethod, createdAt: text(value.createdAt, 'createdAt'),
    image: { path: text(image.path, 'image.path'), width: finite(image.width, 'image.width'), height: finite(image.height, 'image.height'), label: text(image.label, 'image.label') },
    outlines: list('outlines').map((item, index) => {
      if (!isRecord(item) || !['envelope', 'wall', 'plate', 'ellipse', 'outline'].includes(item.kind as string) || typeof item.closed !== 'boolean' || !Array.isArray(item.points) || item.points.length < 2)
        throw new TypeError(`model result outlines[${index}] needs a kind, closed and two or more points.`);
      return { id: text(item.id, `outlines[${index}].id`), label: text(item.label, `outlines[${index}].label`), kind: item.kind as ModelOutline['kind'], closed: item.closed,
        points: item.points.map((point, at) => pair(point, `outlines[${index}].points[${at}]`)) };
    }),
    points: list('points').map((item, index) => { if (!isRecord(item)) throw new TypeError(`model result points[${index}] must be an object.`);
      return { x: finite(item.x, `points[${index}].x`), y: finite(item.y, `points[${index}].y`), kmS: finite(item.kmS, `points[${index}].kmS`) }; }),
    surfaces: list('surfaces').map((item, index) => {
      if (!isRecord(item) || !isRecord(item.values) || !Object.values(item.values).every(entry => typeof entry === 'string' || typeof entry === 'number' && Number.isFinite(entry)))
        throw new TypeError(`model result surfaces[${index}] needs values of numbers and text.`);
      return { kind: text(item.kind, `surfaces[${index}].kind`), label: text(item.label, `surfaces[${index}].label`),
        ...(item.record === undefined ? {} : { record: text(item.record, `surfaces[${index}].record`) }), values: item.values as Record<string, number | string> };
    }),
    metrics: (() => { const metrics = value.metrics; if (!isRecord(metrics) || !Object.values(metrics).every(entry => entry === null || typeof entry === 'string' || typeof entry === 'number'))
      throw new TypeError('model result metrics are numbers, text or null.'); return metrics as Record<string, number | string | null>; })(),
    files: list('files').map((item, index) => text(item, `files[${index}]`)),
    notes: list('notes').map((item, index) => text(item, `notes[${index}]`)) };
}

/** Writes `<method>.json` whole (then renamed), after checking it against the contract the tab reads. */
export async function writeLabModel(root: string, model: LabModel) {
  readLabModel(model);
  const directory = modelDirectory(root, model.id), path = modelPath(root, model.id, model.method);
  await mkdir(directory, { recursive: true });
  await writeFile(`${path}.pending`, JSON.stringify(model) + '\n'); await rename(`${path}.pending`, path);
}

/** An ellipse as a closed outline of `steps` points: centre, semi-axes in pixels, the major axis turned `rotationDeg`. */
export function ellipsePoints(cx: number, cy: number, rx: number, ry: number, rotationDeg: number, steps = 96): [number, number][] {
  const turn = rotationDeg * Math.PI / 180, c = Math.cos(turn), s = Math.sin(turn);
  return Array.from({ length: steps }, (_, k) => {
    const angle = 2 * Math.PI * k / steps, x = rx * Math.cos(angle), y = ry * Math.sin(angle);
    return [cx + x * c - y * s, cy + x * s + y * c] as [number, number];
  });
}
/** A number shown in a table: four significant figures. */
export const shown = (value: number) => Number(value.toPrecision(4));
/** A photograph's credit, short: up to the first parenthesis or semicolon ("B. Balick", "NASA, ESA, CSA, STScI, D. Milisavljevic"). */
export const creditLabel = (credit: string) => credit.split(/ \(|;/)[0]!.trim().slice(0, 80);
