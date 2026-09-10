import {readFile} from 'node:fs/promises';

/** Bind an exported native mesh to the catalog's physical display scale. */
export async function meshSource(candidate) {
  const stem=candidate.mesh.replace('.cms','');
  const root=new URL('./source/meshes/',import.meta.url);
  const report=JSON.parse(await readFile(new URL(`${stem}.json`,root),'utf8'));
  const source=await readFile(new URL(`${stem}.obj`,root),'utf8');
  const scale=candidate.radiusKm*1000;
  const obj=source.split('\n').map(line=>line.startsWith('v ')
    ? 'v '+line.slice(2).split(' ').map(Number).map(v=>v*scale).join(' ')
    : line).join('\n');
  const model={
    schema:'cssearth-celestia-mesh@1',source:candidate.mesh,
    catalogRadiusKm:candidate.radiusKm,
    sourceCodeCommit:'e9997cc011a57fdcc507f4ef5352bfd03cb17a6b',nativeSeed:20260909,
    nativeExport:report,
    scaling:'Celestia bounding-box normalization, then Catalog Radius * 1000 metres. This preserves maximum full extent = 2 * Catalog Radius.',
    axisTransform:report.axisTransform,
    volumeEquivalentRadiusKm:candidate.radiusKm*report.volumeEquivalentRadius,
    illustrative:true,
    qualification:'The actual Celestia CMS mesh is reused. It is a shared illustrative shape, not a measured nucleus reconstruction. Grid surface; fixed illustrative attitude.',
  };
  return {obj,model};
}
