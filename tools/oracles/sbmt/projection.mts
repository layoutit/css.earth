/** Execute unmodified SBMT/SAAVTK/VTK and its FITS dependency. No pipeline
 * implementation or candidate output is imported here. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startNative, hashFile } from './runtime.mts';
import { call, construct, nativeArray } from './java.mts';
import { cases, vector, count, orientations, queryFractions } from './cases.mts';
import { ORACLE_ROOT, assertPinnedInputs } from '../fixture.mts';
import { requireArray, requireFiniteNumber } from '@cssearth/core';

const definitions = await cases();
const inputPaths = [...new Set(['tests/fixtures/sbmt/cases.json', ...definitions.flatMap(c => [c.shape, c.pointing, c.image])])].sort();
const inputs = await Promise.all(inputPaths.map(async path => ({ path, ...await hashFile(resolve(ORACLE_ROOT, path)) })));
await assertPinnedInputs(inputs);
const { java, tool } = await startNative();
const Poly = java.type('edu.jhuapl.saavtk.util.PolyDataUtil');
const output: Record<string, unknown> = {};
const norm = (v: number[]) => v.map(n => n / Math.hypot(...v));
const getPoint = (obj: unknown, i: number) => vector(call(obj, 'GetPointSync', i));
for (const c of definitions) {
  console.log(`SBMT ${c.id}`);
  const reader = construct(java.type(`edu.jhuapl.sbmt.pointing.io.${c.format === 'sum' ? 'Sum' : 'Info'}FileReader`), resolve(ORACLE_ROOT, c.pointing));
  call(reader, 'readSync');
  const origin = vector(call(reader, 'getSpacecraftPositionSync'));
  const frustum = [1,2,3,4].map(i => vector(call(reader, `getFrustum${i}Sync`)));
  if (frustum.some(v => Math.abs(Math.hypot(...v) - 1) > 1e-6)) throw new Error('Native reader did not produce four unit rays');
  const mesh = call(Poly, 'loadPDSShapeModelSync', resolve(ORACLE_ROOT, c.shape));
  const vertices = count(call(mesh, 'GetNumberOfPointsSync')), faces = count(call(mesh, 'GetNumberOfCellsSync'));
  if (vertices !== c.vertices || faces !== c.faces) throw new Error('Native shape dimensions differ from declared case');
  const tree = construct(java.type('vtk.vtkOBBTree'));
  call(tree, 'SetDataSetSync', mesh); call(tree, 'BuildLocatorSync');
  const ids = construct(java.type('vtk.vtkIdList')), hitPoints = construct(java.type('vtk.vtkPoints'));
  call(hitPoints, 'SetDataTypeToDoubleSync');
  // These are declared query rays, not calculated answers. SBMT's own mesh
  // and VTK locator calculate every intersection and its triangle identity.
  const rays: unknown[] = [];
  const fractions = queryFractions;
  const distance = Math.hypot(...origin) * 3;
  for (const y of fractions) for (const x of fractions) {
    const direction = norm(frustum[0].map((v,i) => v + x * (frustum[1][i]-v) + y * (frustum[2][i]-v)));
    call(hitPoints, 'ResetSync'); call(ids, 'ResetSync');
    const end = origin.map((v,i) => v + direction[i] * distance);
    call(tree, 'IntersectWithLineSync', origin, end, hitPoints, ids);
    const hits = Array.from({length: count(call(hitPoints, 'GetNumberOfPointsSync'))}, (_,i) =>
      ({ point: getPoint(hitPoints,i), face: count(call(ids,'GetIdSync',i)) }));
    rays.push({ fraction: [x,y], origin, direction, maximumDistance: distance, hits });
  }
  const sampleVertices = [...new Set([0,1,2,vertices-1,...Array.from({length:32},(_,i)=>Math.floor(i*(vertices-1)/31))])];
  const shapeSamples = sampleVertices.map(index => ({index, point: getPoint(mesh,index)}));
  // Probe UV boundaries, interior, off-image clamping, all supported image
  // orientations, and a central crop. Coordinates stay in the source frame.
  const uvCases: unknown[] = [];
  for (const orientation of [...orientations, 'central-crop']) {
    const corners = orientation === 'flip-x' ? [1,0,3,2] : orientation === 'flip-y' ? [2,3,0,1]
      : orientation === 'rotate-90' ? [2,0,3,1] : orientation === 'rotate-180' ? [3,2,1,0]
      : orientation === 'rotate-270' ? [1,3,0,2] : [0,1,2,3];
    const dirs = orientation === 'central-crop' ? [[.25,.25],[.75,.25],[.25,.75],[.75,.75]].map(([x,y]) =>
      norm(frustum[0].map((v,i) => v+x*(frustum[1][i]-v)+y*(frustum[2][i]-v)))) : corners.map(i=>frustum[i]);
    const swap = orientation === 'rotate-90' || orientation === 'rotate-270';
    const width = swap ? c.height : c.width, height = swap ? c.width : c.height;
    const pts = construct(java.type('vtk.vtkPoints')); call(pts,'SetDataTypeToDoubleSync');
    const queries = fractions.flatMap(y=>fractions.map(x=>{
      const point = origin.map((o,i) => o + (dirs[0][i]+x*(dirs[1][i]-dirs[0][i])+y*(dirs[2][i]-dirs[0][i])) * Math.hypot(...origin));
      call(pts,'InsertNextPointSync',point); return {fraction:[x,y], point, depth:1};
    }));
    const behind=origin.map((o,i)=>o-(dirs[0][i]+dirs[3][i])/2*Math.hypot(...origin));
    call(pts,'InsertNextPointSync',behind);queries.push({fraction:[.5,.5],point:behind,depth:-1});
    const data = construct(java.type('vtk.vtkPolyData')); call(data,'SetPointsSync',pts);
    call(Poly,'generateTextureCoordinatesSync',origin,...dirs,width,height,data);
    const texture = call(call(data,'GetPointDataSync'),'GetTCoordsSync');
    uvCases.push({orientation,width,height,frustum:dirs,probes:queries.map((q,i)=>({...q,uv:vector(call(texture,'GetTuple2Sync',i),2)}))});
    call(data,'DeleteSync'); call(pts,'DeleteSync');
  }
  const model = construct(java.type('edu.jhuapl.sbmt.core.body.SmallBodyModel'), c.id, mesh);
  const footprint = call(model,'computeFrustumIntersectionSync',origin,frustum[0],frustum[2],frustum[3],frustum[1]);
  const footprintCells = footprint === null ? 0 : count(call(footprint,'GetNumberOfCellsSync'));
  // SBMT ships nom-tam-fits. Read native axes and kernel; applying FITS BSCALE
  // and BZERO below is the documented encoding, not a camera/image correction.
  const fits = construct(java.type('nom.tam.fits.Fits'), resolve(ORACLE_ROOT,c.image));
  const hdu = call(fits,'readHDUSync'), axes = vector(call(hdu,'getAxesSync'),2);
  const header = call(hdu,'getHeaderSync');
  const bitpix = requireFiniteNumber(call(header,'getIntValueSync','BITPIX'));
  const scale = requireFiniteNumber(call(header,'getDoubleValueSync','BSCALE',1));
  const zero = requireFiniteNumber(call(header,'getDoubleValueSync','BZERO',0));
  const kernel = nativeArray(call(hdu,'getKernelSync')).map(row=>nativeArray(row));
  if (axes[1] !== c.width || axes[0] !== c.height) throw new Error('FITS dimensions differ from selected pointing case');
  const samples = [...new Set(Array.from({length:65},(_,i)=>Math.floor(i*(c.width*c.height-1)/64)))].map(index=>{
    const raw = requireFiniteNumber(kernel[Math.floor(index/c.width)][index%c.width]);
    return { index, value: (bitpix===8 ? (raw+256)%256 : raw)*scale+zero };
  });
  call(fits,'closeSync');
  output[c.id] = { definition:c, origin, frustum, shapeSamples, rays, uvCases, footprintCells,
    image:{axes,bitpix,scale,zero,samples} };
  if (footprint !== null) call(footprint,'DeleteSync');
  call(hitPoints,'DeleteSync'); call(ids,'DeleteSync'); call(tree,'DeleteSync'); call(mesh,'DeleteSync');
  call(java.type('java.lang.System'),'gcSync');
}
await mkdir(resolve(ORACLE_ROOT,'tests/oracles/sbmt'),{recursive:true});
const destination = process.argv[2] ?? resolve(ORACLE_ROOT,'tests/oracles/sbmt/projection.json');
if (!resolve(destination).startsWith(resolve(ORACLE_ROOT,'tests/oracles')+'/') && !resolve(destination).startsWith(resolve(ORACLE_ROOT,'output')+'/')) throw new Error('Oracle output must be test evidence or scratch');
await writeFile(destination, JSON.stringify({schema:'cssearth-oracle-fixture@1',oracle:'SBMT',generatedBy:'tools/oracles/sbmt/projection.mts',tool,inputs,references:[],cases:output},null,2)+'\n');
console.log(`Wrote ${destination}`);
