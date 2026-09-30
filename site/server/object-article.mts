import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isRecord, hasErrorCode } from '@cssearth/core';

/** Body-authored Wikipedia destination; the shared card header handles names without a pinned article. */
export async function readObjectArticleUrl(objectId: string): Promise<string | undefined> {
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new TypeError('Invalid object article identity.');
  const path = resolve(import.meta.dirname, '../../src/objects', objectId, 'source/presentation/overview.json');
  let text: string;
  try { text = await readFile(path, 'utf8'); }
  catch (error) { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; }
  const presentation: unknown = JSON.parse(text);
  if (!isRecord(presentation) || (presentation.articleUrl !== undefined &&
      (typeof presentation.articleUrl !== 'string' || !/^https:\/\/en\.wikipedia\.org\/wiki\/[^\s?#]+$/u.test(presentation.articleUrl)))) {
    throw new TypeError('Invalid object article presentation.');
  }
  return presentation.articleUrl;
}
