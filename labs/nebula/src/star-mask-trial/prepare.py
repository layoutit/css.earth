#!/usr/bin/env python3
"""One NOX inference per pinned native512 crop; never processes a full source."""
import argparse,hashlib,json,os,time
from pathlib import Path
os.environ['TF_CPP_MIN_LOG_LEVEL']='2'
import cv2,numpy as np,tensorflow as tf

def sha(path):
 h=hashlib.sha256()
 with Path(path).open('rb') as f:
  for block in iter(lambda:f.read(1024*1024),b''):h.update(block)
 return h.hexdigest()

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--source-root',required=True);parser.add_argument('--output',default='.local/nebula-lab/star-mask-trial');args=parser.parse_args()
 root=Path(args.source_root).resolve();out=Path(args.output).resolve()
 if not Path(args.source_root).is_absolute() or '.local' not in out.parts or out==root or root in out.parents:raise ValueError('Explicit absolute source root and separate ignored output required.')
 out.mkdir(parents=True,exist_ok=True);model=root/'.local/open-star-removal/noxGeneratorColor.pb';model_sha=sha(model)
 cases=[('horalek-bright-1','Bright saturated star 1086,2893','horalek-widefield',(830,2637)),('horalek-bright-2','Bright saturated star 920,2341','horalek-widefield',(664,2085)),('horalek-broad','Broad star 2728,3534','horalek-widefield',(2472,3278)),('horalek-nebula','Nebula preservation','horalek-widefield',(4129,1873))]
 for name,label in []: # First delivery stays on the four requested Horálek crops.
  path=root/f'.local/open-star-removal/{name}-detail-rgb-512/receipt.json'
  if path.is_file():cases.append((name+'-detail',label,name,tuple(json.loads(path.read_text())['origin'])))
 graph_def=tf.compat.v1.GraphDef();graph_def.ParseFromString(model.read_bytes());graph=tf.Graph()
 with graph.as_default():tf.import_graph_def(graph_def,name='')
 tensor_in=graph.get_tensor_by_name('inputs:0');tensor_out=graph.get_tensor_by_name('Identity:0')
 manifest=dict(method='NOX',modelSha256=model_sha,normalization='RGB [-1,1]; output(y+1)/2',cases=[])
 receipts=[];loaded={}
 with tf.compat.v1.Session(graph=graph,config=tf.compat.v1.ConfigProto(intra_op_parallelism_threads=6,inter_op_parallelism_threads=2)) as session:
  for identity,label,image_id,origin in cases:
   recipe=json.loads((root/f'labs/nebula/models/lmc-star-separation/{image_id}.json').read_text());source=recipe['source'];path=root/source['path']
   if image_id not in loaded:
    if sha(path)!=source['sha256']:raise ValueError('Native source hash differs.')
    image=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)
    if image.dtype!=np.uint8 or [image.shape[1],image.shape[0]]!=source['nativeDimensions']:raise ValueError('This RGB NOX trial requires exact native8-bit source.')
    jobs=[json.loads(p.read_text()) for p in (root/'.local/nebula-lab/star-removal-jobs').glob('*.json')]
    jobs=[j for j in jobs if j.get('imageId')==image_id and j.get('status')=='completed' and j.get('result',{}).get('sourceSha256')==source['sha256']]
    if jobs:
     job=max(jobs,key=lambda j:j['updatedAt']);baseline_path=Path(job['result']['applied']['native']['diffuse'].removeprefix('/@fs'));baseline_identity=job['id']
    else:baseline_path=root/recipe['outputDirectory']/'diffuse.png';baseline_identity='approved-separation'
    if root not in baseline_path.resolve().parents:raise ValueError('Baseline escaped explicit source root.')
    baseline=cv2.imread(str(baseline_path),cv2.IMREAD_UNCHANGED)
    if baseline is None or baseline.shape!=image.shape or baseline.dtype!=image.dtype or np.any(baseline>image):raise ValueError('Baseline native grid/positive accounting mismatch.')
    loaded[image_id]=(image,baseline,str(baseline_path),sha(baseline_path),baseline_identity)
   image,baseline,baseline_path,baseline_sha,baseline_identity=loaded[image_id];x,y=origin;crop=image[y:y+512,x:x+512].copy();old=baseline[y:y+512,x:x+512].copy()
   if crop.shape!=(512,512,3):raise ValueError('Invalid native crop extent.')
   folder=out/identity;folder.mkdir(exist_ok=True)
   if (folder/'nox.png').is_file():
    assert np.array_equal(cv2.imread(str(folder/'original.png')),crop) and np.array_equal(cv2.imread(str(folder/'baseline.png')),old)
    seconds=None;artifact_elapsed=(folder/'nox.png').stat().st_mtime-(folder/'baseline.png').stat().st_mtime
    timing='Inference plus PNG encoding from retained artifact timestamps; recovered after manifest publication error, no repeated inference.'
   else:
    for name,pixels in [('original',crop),('baseline',old)]:assert cv2.imwrite(str(folder/(name+'.png')),pixels)
    start=time.perf_counter();prediction=session.run(tensor_out,{tensor_in:crop[:,:,::-1].astype(np.float32)[None]/127.5-1})[0][:,:,::-1];seconds=time.perf_counter()-start
    nox=np.rint(np.clip((prediction+1)/2,0,1)*255).astype(np.uint8);assert cv2.imwrite(str(folder/'nox.png'),nox)
    timing='perf_counter around one session.run; excludes decoding and PNG encoding.';artifact_elapsed=None
   row=dict(id=identity,label=label,origin=[x,y],width=512,height=512,source=f'/assets/{identity}/original.png',baseline=f'/assets/{identity}/baseline.png',nox=f'/assets/{identity}/nox.png',noxSeconds=round(seconds,3) if seconds is not None else None)
   if artifact_elapsed is not None:row['artifactElapsedSeconds']=round(artifact_elapsed,3)
   manifest['cases'].append(row)
   receipts.append(dict(**row,nativeSource=source,timingMethod=timing,modelSha256=model_sha,baselinePath=baseline_path,baselineSha256=baseline_sha,baselineIdentity=baseline_identity,outputs={p.name:sha(p) for p in folder.glob('*.png')}))
   (out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(out/'receipt.json').write_text(json.dumps(dict(method='NOX',scriptSha256=sha(__file__),cases=receipts),indent=2)+'\n');print(json.dumps(row),flush=True)
 print('NOX_TRIAL_READY',flush=True)
if __name__=='__main__':main()
