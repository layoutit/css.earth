import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { prepareObjectContent } from '../content/prepare.js';
import type { ObjectContentSource } from '../content/types.js';

for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
  test(`${id} authored content preserves the accepted shell fields and controls`, async () => {
    const root = resolve(process.cwd(), 'src/planets', id);
    const source = JSON.parse(await readFile(resolve(root, 'source/content/object.json'), 'utf8')) as ObjectContentSource;
    const expected = JSON.parse(await readFile(resolve(root, 'prepared/content.json'), 'utf8'));
    const controls = JSON.parse(await readFile(resolve(root, 'prepared/controls.json'), 'utf8'));
    const actual = prepareObjectContent(source);
    for (const key of ['objectId', 'introduction', 'facts', 'moreFacts', 'resources', 'galleries'] as const) {
      assert.deepEqual(actual[key], expected[key], `${id}: ${key}`);
    }
    for (const key of ['label', 'viewBox', 'path', 'renderViewBox', 'renderWidth', 'renderHeight', 'renderPathOffsetY'] as const) {
      assert.deepEqual(actual.title[key], expected.title[key], `${id}: title.${key}`);
    }
    assert.deepEqual(actual.settings, controls.settings);
    assert.deepEqual({ ...actual.lenses, controls: actual.lenses.controls.map(({id,label,thumbnailUrl,description,legend,title}) =>
      ({id,label,thumbnailUrl,description,...(legend ? {legend} : {}),title})) }, controls.lenses);
    assert.deepEqual(actual.charts.map(({id,title,open,src,width,height,alt})=>({id,title,open,src,width,height,alt})),
      expected.charts.map(({id,title,open,src,width,height,alt}: Record<string, unknown>)=>({id,title,open,src,width,height,alt})));
  });
}
