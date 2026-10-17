import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { GALAXY_SLICES } from './galaxy-slice-source.mts';
import { GALAXY_OUTSIDE_DISPLAY_SCALE } from './galaxy-outside-display.mts';

// This exercises the real bake, not a second implementation of the slab sampler.
const FIXTURE = String.raw`
import json,os,sys,numpy as np,subprocess
from PIL import Image
root,script,scale=sys.argv[1:];scale=float(scale)
q={k:0 for k in ('camRG','camRB','camGR','camGB','camBR','camBG')}
q.update(wbSkyR=1,wbSkyB=1,camSaturation=1)
m={'dims':[17,17,17],'box':[0,16,0,16,0,16],'originKpc':[0,0,0],'spacingKpc':[1,1,1],
 'camera':q,'extinctionPerChannel':[.6,1,1.3]}
json.dump({'params':{'logExposure':0}},open(root+'/fit.json','w'))
# A single off-centre compact blob above a smooth emitting background. The background
# makes the former column-share painter reveal the blob on unrelated foreground slabs.
for variant in ('smooth','blob','isolated'):
 folder=root+'/'+variant;os.makedirs(folder)
 json.dump(m,open(folder+'/meta.json','w'))
 e=np.full((17,17,17,3),.02,dtype='<f4') if variant!='isolated' else np.zeros((17,17,17,3),dtype='<f4')
 if variant!='smooth':e[3,5,11]=[3,1,.4]
 e.tofile(folder+'/emission.f32');np.zeros((17,17,17,3),dtype='<f4').tofile(folder+'/scatter.f32')
 np.zeros((17,17,17),dtype='<f4').tofile(folder+'/dust.f32')
 subprocess.run([sys.executable,script,folder,folder+'/out',root+'/fit.json',json.dumps({'mode':'outside-display','counts':[4,4,4],'displayScale':scale})],check=True)
changed={};isolated={}
# Trilinear nodal support is x=10..12, y=4..6, z=2..4. Only intersecting slabs may change.
allowed={'x':{2},'y':{1},'z':{0}}
for axis in 'xyz':
 changed[axis]=[];isolated[axis]=[]
 for i in range(4):
  name=axis+'/'+str(i).zfill(3)+'.png'
  a=np.array(Image.open(root+'/smooth/out/'+name));b=np.array(Image.open(root+'/blob/out/'+name))
  c=np.array(Image.open(root+'/isolated/out/'+name))
  if not np.array_equal(a,b):changed[axis].append(i)
  if np.any(c):isolated[axis].append(i)
 assert set(changed[axis])==allowed[axis],('blob changed an unrelated slab',axis,changed)
 assert set(isolated[axis])==allowed[axis],('blob leaked outside its slab',axis,isolated)
print('SLAB LOCALITY VERIFIED',json.dumps({'changed':changed,'isolated':isolated}))
`;

test('a single off-centre blob changes only intersecting slabs, including above smooth emission', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'galaxy-slab-local-'));
  try {
    const source = process.env.CSSEARTH_SLAB_MUTATION_SOURCE;
    writeFileSync(resolve(directory, 'slices.py'), source ? readFileSync(source, 'utf8') : GALAXY_SLICES);
    writeFileSync(resolve(directory, 'fixture.py'), FIXTURE);
    const run = spawnSync(process.env.CSSEARTH_TORCH_PYTHON ?? 'python3', [resolve(directory, 'fixture.py'), directory,
      resolve(directory, 'slices.py'), String(GALAXY_OUTSIDE_DISPLAY_SCALE)], { encoding: 'utf8', timeout: 60_000 });
    assert.equal(run.status, 0, `${run.error?.message ?? ''}\n${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /SLAB LOCALITY VERIFIED/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
