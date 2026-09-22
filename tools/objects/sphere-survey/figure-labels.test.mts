import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readPdfImage } from '../../fits/pdf-image.mts';
import { figureBands, figureCells, parseComparisonSpec, type Raster } from '../surface-observations/published-comparison.mts';
import { glyphTemplates, readLabel } from './figure-labels.mts';

const ROOT = resolve(import.meta.dirname, '../../..'), PAPER = resolve(ROOT, 'src/objects/iris/source/reference/vernazza-2021.pdf');

/** Every label of a figure, band by band, as the setup tool reads them. */
function labels(pdf: Buffer, object: number, templates: ReturnType<typeof glyphTemplates>) {
  const figure: Raster = readPdfImage(pdf, object), bands = figureBands(figure), rows = Math.round((bands[0].y1 - bands[0].y0) / 240);
  return bands.flatMap((band, index) => figureCells(figure, rows, Math.round((band.x1 - band.x0) / 240), index)[0].map(cell => readLabel(figure, cell, templates)));
}

test('the survey figures\' column times read as printed, where the paper is restored', { skip: !existsSync(PAPER) }, () => {
  const pdf = readFileSync(PAPER), iris = parseComparisonSpec(JSON.parse(readFileSync(resolve(ROOT, 'src/objects/iris/source/preparation/published-comparison.json'), 'utf8')));
  const reference: Raster = readPdfImage(pdf, iris.document.object);
  const templates = glyphTemplates(reference, figureCells(reference, iris.rows.count, iris.columns.length)[0], iris.columns.map(column => column.label));
  // Read by eye from the figures; every one but Amphitrite's 07:21:27, which LAM did not release, is a frame's exposure start.
  assert.deepEqual(labels(pdf, 1089, templates), ['2018-02-06T02:26:57', '2019-04-19T04:01:56', '2019-05-04T07:44:28', '2019-06-05T05:38:50', '2019-06-19T03:39:14'], 'Parthenope, whose last panel meets the figure frame');
  assert.deepEqual(labels(pdf, 1099, templates), ['2017-05-20T01:37:59', '2017-05-20T02:33:28', '2018-06-08T09:22:40', '2019-08-16T06:39:41', '2019-08-16T07:21:27', '2019-08-16T08:00:28',
    '2019-08-17T06:24:17', '2019-08-17T07:40:29', '2019-08-17T08:19:17', '2019-08-22T07:00:43', '2019-08-23T08:25:46', '2019-08-29T05:49:03'], 'Amphitrite, in two bands');
  assert.deepEqual(labels(pdf, 1104, templates), ['2017-11-02T03:13:39', '2017-11-29T00:34:37'], 'Doris, whose figure has no MPCD row');
});
