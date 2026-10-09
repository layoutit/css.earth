import { isRecord } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { candidatePictures } from './candidate-pictures.ts';

/** Lab-only published 3D models of a plate object, kept beside its candidate pictures in ignored scratch:
 * `src/objects/<owner>/.local/candidates/models/prepared/index.json` lists them and `<id>.json` holds each one's places
 * (arcseconds east, north and toward the Sun from the expansion centre), as `prepare-candidate-models.mts` writes
 * them. Nothing here ships. */
const MODELS = 'models/prepared';

export async function candidateModels(root: string, object: string) {
  const set = await candidatePictures(root, object);
  if (!set) return { models: [] };
  const raw: unknown = JSON.parse(await readFile(resolve(root, set.directory, MODELS, 'index.json'), 'utf8').catch(() => 'null'));
  return { models: isRecord(raw) && Array.isArray(raw.models) ? raw.models.filter(isRecord) : [] };
}

export async function candidateModel(root: string, object: string, id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) throw new TypeError('Name a candidate model.');
  const set = await candidatePictures(root, object);
  if (!set) throw new TypeError(`No candidate models for ${object}.`);
  return JSON.parse(await readFile(resolve(root, set.directory, MODELS, `${id}.json`), 'utf8')) as unknown;
}

/** One model's texture from one registered picture (`prepared/textures/<id>--<texture>.json`, and its atlas PNG for a
 * mesh), as `output/cas-a-models/textured/textures.py` writes them. */
export async function candidateModelTexture(root: string, object: string, id: string, texture: string, part: 'json' | 'png') {
  if (!/^[a-z0-9-]+$/.test(id) || !/^(nircam|miri|chandra)$/.test(texture)) throw new TypeError('Name a candidate model and texture.');
  const set = await candidatePictures(root, object);
  if (!set) throw new TypeError(`No candidate models for ${object}.`);
  return readFile(resolve(root, set.directory, MODELS, 'textures', `${id}--${texture}.${part}`));
}
