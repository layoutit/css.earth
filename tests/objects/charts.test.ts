import { sourceTest } from './source-test.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareChartAssets,parseChartAssetRecipe} from '../../tools/objects/content/charts.js';

test('phase source rejects an uncovered angle range',()=>{
 assert.throws(()=>parseChartAssetRecipe({schema:'cssearth-chart-assets@1',publicBase:'/scenes/open-body/',charts:[{kind:'phase',id:'phase',title:'Phase',description:'Observed model',output:'phase.svg',metadata:{},sampleCount:181,maximumAngleDegrees:180,segments:[{kind:'polynomialMagnitude',maximumAngleDegrees:90,coefficients:[1,2]}]}]}),/cover/);
});
