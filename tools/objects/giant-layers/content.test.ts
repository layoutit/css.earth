import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareObjectContent } from '../content/prepare.js';
import type { ObjectContentSource } from '../content/types.js';

for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
  test(`${id} authored content preserves the accepted shell fields and controls`, async () => {
    const root = resolve(process.cwd(), 'src/objects', id);
    const source = JSON.parse(await readFile(resolve(root, 'source/content/object.json'), 'utf8')) as ObjectContentSource;
    const expected = JSON.parse(await readFile(resolve(root, 'prepared/content.json'), 'utf8'));
    const controls = JSON.parse(await readFile(resolve(root, 'prepared/controls.json'), 'utf8'));
    const actual = prepareObjectContent(source);
    for (const key of ['objectId', 'facts', 'moreFacts', 'resources', 'galleries'] as const) {
      assert.deepEqual(actual[key], expected[key], `${id}: ${key}`);
    }
    for (const key of ['label', 'viewBox', 'path', 'renderViewBox', 'renderWidth', 'renderHeight', 'renderPathOffsetY'] as const) {
      assert.deepEqual(actual.title[key], expected.title[key], `${id}: title.${key}`);
    }
    // The typed generator changes its own identity; font pins and SVG bytes stay fixed.
    assert.equal(controls.settings.title.generator, 'tools/prepare/prepare-shell-titles.mts');
    assert.deepEqual(actual.settings, { ...controls.settings,
      title: { ...controls.settings.title, generator: 'tools/prepare/prepare-shell-titles.mts' } });
    assert.deepEqual({ ...actual.lenses, controls: actual.lenses.controls.map(({id,label,thumbnailUrl,noData,facts,legend,legendNote}) =>
      ({id,label,thumbnailUrl,...(noData === true ? {noData} : {}),...(facts?.length ? {facts} : {}),...(legend ? {legend} : {}),...(legendNote ? {legendNote} : {})})) }, controls.lenses);
    assert.deepEqual(actual.charts.map(({id,title,open,src,width,height,alt})=>({id,title,open,src,width,height,alt})),
      expected.charts.map(({id,title,open,src,width,height,alt}: Record<string, unknown>)=>({
        id, title: (title as Record<string, unknown>).generator === 'tools/prepare-shell-titles.mjs'
          ? { ...(title as Record<string, unknown>), generator: 'tools/prepare/prepare-shell-titles.mts' } : title,
        open, src, width, height, alt,
      })));
  });
}
