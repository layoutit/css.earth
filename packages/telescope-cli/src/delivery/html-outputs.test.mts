import '../test-user-root.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { parseHTML } from 'linkedom';
import { writeHtmlFixtures } from './html-fixture.mts';
import { exportHtml } from './html-outputs.mts';
import { listArtifactOutputs } from './artifact-outputs.mts';
import { formatArtifact, artifactScreen } from '../cli-format.mts';
import { parseCli } from '../cli-arguments.mts';
import { assertStandaloneHtml } from '../sphere/sphere-oracle.mts';
import { spectrumChart } from './spectrum-html.mts';

const credit='Fixture Observatory <science>';
function assertFinalSampleError(svg: Element): void {
  const bar=svg.querySelector('path.uncertainty[data-x="5"]');assert.ok(bar,'Final sample needs a painted error bar.');
  const segment=/^M([\d.-]+) ([\d.-]+)V([\d.-]+)$/u.exec(bar.getAttribute('d')??'');assert.ok(segment);
  const [,x,top,bottom]=segment;
  assert.ok([x,top,bottom].every(value=>Number.isFinite(Number(value))));
  assert.ok(Math.abs(Number(bottom)-Number(top))>0,'Error bar must have non-zero length.');
  assert.ok(Number(bar.getAttribute('stroke-width'))>0);
  assert.ok(bar.getAttribute('stroke')&&bar.getAttribute('stroke')!=='none');
}
function assertVisiblePointSvg(html: string): number {
  const {document}=parseHTML(html),svg=document.querySelector('.point-layer svg');
  assert.ok(svg,'Point viewer must contain its SVG layer.');
  const box=svg.getAttribute('viewBox')!.split(/\s+/u).map(Number);
  assert.equal(box.length,4);assert.ok(box.every(Number.isFinite));
  const [left,top,width,height]=box as [number,number,number,number];
  assert.ok(width>0&&height>0);
  let visible=0,aboveFloor=0;
  for(const path of svg.querySelectorAll('path[d]')) {
    const radius=Number(path.getAttribute('stroke-width'))/2;
    assert.ok(Number.isFinite(radius)&&radius>0,'Point radius must be positive.');
    const stroke=path.getAttribute('stroke')!;assert.match(stroke,/^#[\da-f]{8}$/iu);
    const alpha=Number.parseInt(stroke.slice(7),16)/255;
    assert.ok(alpha>0,'Point paint must have positive opacity.');
    let dx=0,dy=0,opacity=alpha;
    for(let node:Element|null=path;node&&node!==svg;node=node.parentElement) {
      assert.notEqual(node.getAttribute('display'),'none');assert.notEqual(node.getAttribute('visibility'),'hidden');
      const style=node.getAttribute('style')??'';
      assert.doesNotMatch(style,/(?:^|;)(?:display\s*:\s*none|visibility\s*:\s*hidden)(?:;|$)/u);
      const inlineOpacity=/(?:^|;)opacity\s*:\s*([^;]+)/u.exec(style);
      opacity*=Number(node.getAttribute('opacity')??1)*Number(inlineOpacity?.[1]??1);
      const transform=node.getAttribute('transform');
      if(transform) {
        const translation=/^translate\(([^ ]+) ([^)]+)\)$/u.exec(transform);assert.ok(translation);
        dx+=Number(translation[1]);dy+=Number(translation[2]);
      }
    }
    assert.ok(Number.isFinite(opacity)&&opacity>0);
    const dots=path.getAttribute('d')!.split('M');assert.equal(dots.shift(),'');
    for(const dot of dots) {
      const coordinates=/^(\S+) (\S+)h\.01$/u.exec(dot);assert.ok(coordinates,'Expected the shared point layer dot path.');
      const x=Number(coordinates[1])+dx,y=Number(coordinates[2])+dy;
      assert.ok(Number.isFinite(x)&&Number.isFinite(y),'Point coordinates must be finite.');
      if(x>=left&&x<=left+width&&y>=top&&y<=top+height) {
        visible++;if(opacity>1/255)aboveFloor++;
      }
    }
  }
  assert.ok(visible>0,'Point viewer must paint points inside its view box.');
  assert.ok(aboveFloor>0,'Point viewer must show stars above the barely visible coverage-anchor floor.');
  return visible;
}
test('HTML routes image, spectrum and volume through offline exports with literal CSS and visible receipts',async()=>{
  const root=await mkdtemp(resolve(tmpdir(),'html-viewers-'));
  try {
    await writeHtmlFixtures(root,true);
    for(const kind of ['image','spectrum','volume','points'] as const) {
      const path=resolve(root,kind,kind==='volume'||kind==='points'?'object.json':'output.product.json');
      const listed=await listArtifactOutputs(path);
      assert.equal(listed.outputs[0].kind,'html');assert.equal(listed.outputs[0].available,true);
      const screen=formatArtifact(artifactScreen(listed,path));assert.match(screen.split('Next:')[1],/--output html/u);
      const result=await exportHtml(path,resolve(root,`${kind}-html`)),html=await readFile(result.html,'utf8');
      assertStandaloneHtml(html);
      const {document}=parseHTML(html);if(kind==='points'){assert.ok(JSON.parse(document.querySelector('details pre')!.textContent!).provenance);}
      else assert.ok(document.querySelector('details pre')!.textContent?.includes(credit));
      if(kind==='image'||kind==='spectrum'){const labels=[...document.querySelectorAll('dt')],instrument=labels.find(label=>label.textContent==='Instrument');assert.equal(instrument?.nextElementSibling?.textContent,'Fixture camera');}
      if(kind==='image'){
        assert.match(document.querySelector('img')!.getAttribute('src')!,/^data:image\/png;base64,/u);
        assert.match(document.querySelector('style')!.textContent!,/\.measurement-image\{width:100%;height:auto;image-rendering:pixelated\}/u);
        assert.ok(document.querySelector('img.measurement-image'));
      }
      if(kind==='spectrum'){
        assert.equal(document.querySelectorAll('svg').length,1);const svg=document.querySelector('svg')!;
        assert.equal(svg.querySelectorAll('polygon.uncertainty').length,1);
        assert.equal(svg.querySelectorAll('.object-chart-line').length,2);assertFinalSampleError(svg);
        for(const mutate of [(bar:Element)=>bar.remove(),(bar:Element)=>bar.setAttribute('d','M294 203V203'),(bar:Element)=>bar.setAttribute('stroke-width','0')]){
          const changed=parseHTML(html).document.querySelector('svg')!;mutate(changed.querySelector('path.uncertainty[data-x="5"]')!);
          assert.throws(()=>assertFinalSampleError(changed));
        }
        assert.ok(svg.textContent?.includes('Value (Jy)'));
      }
      if(kind==='volume'){assert.equal(document.querySelectorAll('.css-volume-projection').length,1);assert.ok(document.querySelector('.css-volume-mesh s'));assert.equal(document.querySelectorAll('svg').length,0);}
      if(kind==='points'){
        assert.equal(document.querySelectorAll('.point-layer svg').length,1);assertVisiblePointSvg(html);
        for(const mutate of [
          (svg:Element)=>{for(const path of svg.querySelectorAll('path'))path.remove();},
          (svg:Element)=>{for(const path of svg.querySelectorAll('path'))path.setAttribute('d','MNaN 0h.01');},
          (svg:Element)=>{for(const path of svg.querySelectorAll('path'))path.setAttribute('d','M10000 10000h.01');},
          (svg:Element)=>{for(const path of svg.querySelectorAll('path'))path.setAttribute('stroke-width','0');},
          (svg:Element)=>{for(const path of svg.querySelectorAll('path'))path.setAttribute('stroke','#ffffff00');},
          (svg:Element)=>{for(const path of svg.querySelectorAll('path'))path.setAttribute('stroke','#ffffff01');},
          (svg:Element)=>{svg.querySelector('g')!.setAttribute('opacity','0');},
        ]) {
          const changed=parseHTML(html).document;mutate(changed.querySelector('.point-layer svg')!);
          assert.throws(()=>assertVisiblePointSvg(changed.toString()));
        }
      }
      const receipt=JSON.parse(await readFile(result.receipt,'utf8'));assert.equal(receipt.stage,'telescope-html');
      for(const mutation of [html.replace('</main>','<script></script></main>'),html.replace('</style>','x{filter:blur(1px)}</style>'),html.replace('</style>','x{--drawing:1}</style>'),html.replace('</main>','<img src="https://example.invalid/p.png"></main>'),html.replace('</main>','<s onclick="bad()"></s></main>')])assert.throws(()=>assertStandaloneHtml(mutation));
    }
    const bank=resolve(root,'bank.json');await writeFile(bank,JSON.stringify({schema:'cssearth-object@2',type:'volume-dataset-bank'}));
    await assert.rejects(exportHtml(bank,resolve(root,'bank-html')),/sky banks, impostor banks and dataset banks.*planned/u);
    assert.equal(parseCli(['export','result.json','--output','html','--out','out']).command,'html');
    assert.throws(()=>parseCli(['export','result.json','--output','html','--hdu','0','--out','out']),/only/u);
  }finally{await rm(root,{recursive:true,force:true});}
});
test('spectrum preserves masked gaps and refuses malformed coordinates or negative uncertainty',()=>{
  assert.throws(()=>spectrumChart('wavelength_um,value,standard_deviation\n1,2,-1\n','Jy'),/uncertainty/u);
  assert.throws(()=>spectrumChart('wavelength_um,value,standard_deviation\n1,2,1\n1,3,1\n','Jy'),/monotonic/u);
  assert.throws(()=>spectrumChart('wavelength_um,value,standard_deviation\n1,,\n','Jy'),/no usable/u);
});
