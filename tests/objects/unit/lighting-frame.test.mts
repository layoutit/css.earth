import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../../site/objects.mts';
import { projectRoot } from '../fixtures.mts';
import { sourceTest } from '../source-test.mts';

const test = sourceTest();
const json = async (path: string) => JSON.parse(await readFile(resolve(projectRoot, path), 'utf8')) as Record<string, any>;
const optional = (path: string) => json(path).catch(() => null);

/** What a browser would show and a bake does not check, read from the recipes and stylesheets of every body: the two ways a lit
 * body has reached the site drawn wrong. Kepler-186 f and nine other planets (until 2026-09-24), and Neptune and Uranus (from
 * 2026-09-17), loaded no rule sizing their lighting frame, so the frame measured 0 x 0 and the sphere was drawn unlit. */
test('every composite lit body sizes its lighting frame to its own sphere', async () => {
  const wrong: string[] = [];
  for (const { id } of SCENE_OBJECTS) {
    const raster = await optional(`src/objects/${id}/source/preparation/raster.json`), presentation = await optional(`src/objects/${id}/source/preparation/presentation.json`);
    // The composite presentation draws the lighting bank on one frame over the sphere; the row-bank cutaway lights each face.
    if (!raster?.lighting || presentation?.mode !== 'composite') continue;
    const descriptor = await json(`src/objects/${id}/object.json`);
    const css = (await Promise.all((descriptor.properties.page?.stylesheets ?? []).map((path: string) => readFile(resolve(projectRoot, path), 'utf8').catch(() => '')))).join('\n');
    const rules = [...css.matchAll(new RegExp(`([^{}]*\\.${id}-fixed-material\\s*)\\{([^}]*)\\}`, 'gu'))].filter(([, selector]) => !selector!.includes('hide-shadows') && !selector!.includes('[data-lens'));
    const sized = rules.map(([, , body]) => body!).filter(body => /\bwidth:\s*[\d.]+px/u.test(body)).at(-1);
    if (!sized) { wrong.push(`${id}: no stylesheet rule gives .${id}-fixed-material a width, so the lighting frame is 0 x 0`); continue; }
    const width = Number(/\bwidth:\s*([\d.]+)px/u.exec(sized)![1]), scale = Number(/scale\(([\d.]+)\)/u.exec(sized)?.[1] ?? 1);
    const radius = Number(/"radius":\s*([\d.]+)/u.exec(await readFile(resolve(projectRoot, `src/objects/${id}/source/preparation/geometry.json`), 'utf8'))?.[1]);
    if (Math.abs(width * scale - 2 * radius) > 1) wrong.push(`${id}: the lighting frame is ${(width * scale).toFixed(1)} units across and the sphere ${2 * radius} (geometry.json radius ${radius})`);
  }
  assert.deepEqual(wrong, []);
});

test('a shape-only planet under a star with a measured colour is lit by that colour, not a white lamp', async () => {
  const gray: string[] = [];
  for (const { id } of SCENE_OBJECTS.filter(object => object.classification === 'exoplanet')) {
    const raster = await optional(`src/objects/${id}/source/preparation/raster.json`), body = await optional(`packages/astronomy/data/bodies/${id}.json`);
    const science = raster?.surfaces?.[0]?.science;
    if (science?.kind !== 'neutral-shape' || raster?.emission || science.hostLight) continue;
    const host = body?.physical?.parent, hostRaster = host ? await optional(`src/objects/${host}/source/preparation/raster.json`) : null;
    if (hostRaster?.surfaces?.[0]?.science?.kind === 'stellar-photometric-color') gray.push(`${id} (host ${host}): telescope new-object --host-light ${id}`);
  }
  assert.deepEqual(gray, []);
});
