import {parseSaturnScene,parseSaturnViews,parseSaturnLenses,parseSaturnLayouts} from './fixtures/saturn-prepared.mts';
import {parseTitle,parsePanel,parseContent} from './fixtures/prepared-schemas.mts';
import {parsePreparedObjectRuntime} from '@cssearth/renderer';
import {requireObjectRuntimeDefinition} from '../../tools/contract/object-runtime-contract.mts';
import {validatePreparedCubicSky} from '../../src/platform/cubic-sky-contract.mts';
import {validateDirectionalSunPlan} from '../../src/platform/directional-sun-contract.mts';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
function checkedRuntime(value:unknown){const checked=requireObjectRuntimeDefinition(value);return {...checked,controls:parsePreparedObjectRuntime(value).controls};}
/** Tests consume the same JSON preparation products as the shared renderer. */
export async function readPreparedFixture(id:'saturn',artifact:'scene'):Promise<ReturnType<typeof parseSaturnScene>>;
export async function readPreparedFixture(id:'saturn',artifact:'views'):Promise<ReturnType<typeof parseSaturnViews>>;
export async function readPreparedFixture(id:'saturn',artifact:'material-lenses'):Promise<ReturnType<typeof parseSaturnLenses>>;
export async function readPreparedFixture(id:'saturn',artifact:'layouts'):Promise<ReturnType<typeof parseSaturnLayouts>>;
export async function readPreparedFixture(id:string,artifact:'title'):Promise<ReturnType<typeof parseTitle>>;
export async function readPreparedFixture(id:string,artifact:'panel'):Promise<ReturnType<typeof parsePanel>>;
export async function readPreparedFixture(id:string,artifact:'content'):Promise<ReturnType<typeof parseContent>>;
export async function readPreparedFixture(id:string,artifact:'runtime'):Promise<ReturnType<typeof checkedRuntime>>;
export async function readPreparedFixture(id:string,artifact:'sky'):Promise<ReturnType<typeof validatePreparedCubicSky>>;
export async function readPreparedFixture(id:string,artifact:'sun'):Promise<ReturnType<typeof validateDirectionalSunPlan>>;
export async function readPreparedFixture(id:string,artifact:string):Promise<unknown>;
export async function readPreparedFixture(id: string, artifact: string): Promise<unknown> {
  if (!/^[a-z][a-z0-9-]*$/.test(id) || !/^[a-z][a-z0-9-]*$/.test(artifact)) throw new TypeError('Unsafe prepared fixture address.');
  const root = process.env.OBJECT_PREPARATION_ROOT
    ? resolve(process.env.OBJECT_PREPARATION_ROOT, id)
    : resolve(projectRoot, 'src/objects', id, 'prepared');
  const value:unknown=JSON.parse(await readFile(resolve(root, `${artifact}.json`), 'utf8'));
  if(artifact==='runtime')return checkedRuntime(value);
  if(artifact==='sky')return validatePreparedCubicSky(value);
  if(artifact==='sun')return validateDirectionalSunPlan(value);
  if(artifact==='title')return parseTitle(value);
  if(artifact==='panel')return parsePanel(value);
  if(artifact==='content')return parseContent(value);
  if(artifact==='scene'&&id==='saturn')return parseSaturnScene(value);
  if(artifact==='views'&&id==='saturn')return parseSaturnViews(value);
  if(artifact==='material-lenses'&&id==='saturn')return parseSaturnLenses(value);
  if(artifact==='layouts'&&id==='saturn')return parseSaturnLayouts(value);
  return value;
}
