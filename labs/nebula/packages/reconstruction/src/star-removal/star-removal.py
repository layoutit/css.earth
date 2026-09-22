#!/usr/bin/env python3
"""Pinned NOX inference on native RGB grids; positive residual, no source writes."""
import hashlib,json,math,os,sys,time
from pathlib import Path
os.environ['TF_CPP_MIN_LOG_LEVEL']='2'
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['VECLIB_MAXIMUM_THREADS']='1'
import cv2,numpy as np
cv2.setNumThreads(6)
TILE,STRIDE,PAD,BATCH=512,384,64,2

def sha(path):
 value=hashlib.sha256()
 with Path(path).open('rb') as stream:
  for block in iter(lambda:stream.read(1024*1024),b''):value.update(block)
 return value.hexdigest()

def emit(stage,current,total,message):
 print(json.dumps(dict(type='progress',stage=stage,current=current,total=total,message=message)),flush=True)

def read_pin(pin,dimensions=False):
 if not isinstance(pin,dict) or set(pin)!=({'path','sha256','nativeDimensions'} if dimensions else {'path'}) or not Path(pin['path']).is_absolute() or ('sha256' in pin and sha(pin['path'])!=pin['sha256']):
  raise ValueError('Pinned source/model/baseline identity differs.')
 return Path(pin['path'])

def decode(path):
 image=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)
 if image is None or image.dtype!=np.uint8 or image.ndim!=3 or image.shape[2]!=3:raise ValueError('NOX requires native8-bit RGB without alpha.')
 return image

class Nox:
 def __init__(self,path):
  import tensorflow as tf
  start=time.perf_counter();definition=tf.compat.v1.GraphDef();definition.ParseFromString(path.read_bytes());graph=tf.Graph()
  with graph.as_default():tf.import_graph_def(definition,name='')
  self.input=graph.get_tensor_by_name('inputs:0');self.output=graph.get_tensor_by_name('Identity:0')
  self.session=tf.compat.v1.Session(graph=graph,config=tf.compat.v1.ConfigProto(intra_op_parallelism_threads=6,inter_op_parallelism_threads=1))
  self.load_seconds=time.perf_counter()-start;self.seconds=0.;self.tiles=0
 def __call__(self,tiles):
  tensor=np.stack(tiles)[:,:,:,::-1].astype(np.float32)/127.5-1
  start=time.perf_counter();result=self.session.run(self.output,{self.input:tensor});self.seconds+=time.perf_counter()-start;self.tiles+=len(tiles)
  if result.shape!=tensor.shape or not np.isfinite(result).all():raise ValueError('NOX returned invalid pixels.')
  return np.clip((result[:,:,:,::-1]+1)*127.5,0,255)
 def close(self):self.session.close()

def tile_at(image,x,y):
 h,w=image.shape[:2];x0,y0=max(0,x),max(0,y);x1,y1=min(w,x+TILE),min(h,y+TILE)
 return cv2.copyMakeBorder(image[y0:y1,x0:x1],y0-y,y+TILE-y1,x0-x,x+TILE-x1,cv2.BORDER_REFLECT_101)

def positive_union(source,predicted,baseline=None):
 residual=np.maximum(0,source.astype(np.int16)-np.rint(predicted).astype(np.int16))
 if baseline is not None:np.maximum(residual,source.astype(np.int16)-baseline,out=residual)
 stars=residual.astype(np.uint8);return source-stars,stars,np.where(np.any(stars>0,axis=2),255,0).astype(np.uint8)

def tiled_remove(image,predict,baseline=None,batch_size=BATCH,progress=emit):
 """128px overlaps; outer32px ignored, cosine ramps, bounded512-row accumulator."""
 h,w=image.shape[:2];stars=np.empty_like(image);mask=np.empty((h,w),np.uint8)
 accumulator=np.zeros((TILE,w,3),np.float32);weights=np.zeros((TILE,w),np.float32)
 axis=np.arange(TILE,dtype=np.float32);ramp=np.clip(np.minimum(axis-32,479-axis)/64,0,1);ramp=(1-np.cos(np.pi*ramp))/2
 window=ramp[:,None]*ramp[None,:]
 base=0;done=0;total=math.ceil(h/STRIDE)*math.ceil(w/STRIDE);minimum_weight=float('inf')
 for cy in range(0,h,STRIDE):
  positions=[(cx-PAD,cy-PAD) for cx in range(0,w,STRIDE)]
  for first in range(0,len(positions),batch_size):
   batch=positions[first:first+batch_size];predictions=predict([tile_at(image,x,y) for x,y in batch])
   for (x,y),prediction in zip(batch,predictions):
    x0,y0=max(0,x),max(0,y);x1,y1=min(w,x+TILE),min(h,y+TILE);local=window[y0-y:y1-y,x0-x:x1-x]
    accumulator[y0-base:y1-base,x0:x1]+=prediction[y0-y:y1-y,x0-x:x1-x]*local[:,:,None]
    weights[y0-base:y1-base,x0:x1]+=local
   done+=len(batch);progress('removing-stars',done,total,f'Removed stars in native tiles {done} of {total}')
  stop=h if cy+STRIDE>=h else min(h,cy+STRIDE-PAD);count=stop-base
  if np.any(weights[:count]<=0):raise AssertionError('Native tiling left uncovered pixels.')
  minimum_weight=min(minimum_weight,float(weights[:count].min()))
  predicted=accumulator[:count]/weights[:count,:,None]
  _,stars[base:stop],mask[base:stop]=positive_union(image[base:stop],predicted,None if baseline is None else baseline[base:stop])
  accumulator[:-count]=accumulator[count:];accumulator[-count:]=0;weights[:-count]=weights[count:];weights[-count:]=0;base=stop
 if base!=h:raise AssertionError('Native tiling did not finish.')
 return image-stars,stars,mask,dict(tiles=total,batchSize=batch_size,minimumWeight=minimum_weight,coverageComplete=True)

def automatic_origins(image):
 """Bounded multiscale selection: brightest compact response, structure, quiet field, centre."""
 h,w=image.shape[:2];size=min(TILE,h,w);candidates=[]
 for cy in np.linspace(size/2,h-size/2,4):
  for cx in np.linspace(size/2,w-size/2,4):
   x,y=int(cx-size/2),int(cy-size/2);crop=image[y:y+size,x:x+size];gray=cv2.cvtColor(crop,cv2.COLOR_BGR2GRAY).astype(np.float32)
   response=cv2.GaussianBlur(gray,(0,0),2)-cv2.GaussianBlur(gray,(0,0),8);_,peak,_,location=cv2.minMaxLoc(response)
   bx=max(0,min(w-size,x+location[0]-size//2));by=max(0,min(h-size,y+location[1]-size//2))
   structure=float(cv2.GaussianBlur(gray,(0,0),12).std());candidates.append(dict(origin=(x,y),bright=(bx,by),peak=peak,structure=structure))
 choices=[('bright','Bright compact field',max(candidates,key=lambda c:c['peak'])['bright']),('structure','Structured region',max(candidates,key=lambda c:c['structure'])['origin']),('field','Quiet field',min(candidates,key=lambda c:c['structure'])['origin']),('centre','Central field',((w-size)//2,(h-size)//2))]
 seen=set();return [(identity,label,origin,size) for identity,label,origin in choices if not (origin in seen or seen.add(origin))]

def reduced(image,maximum):
 scale=min(1,maximum/max(image.shape[:2]));return cv2.resize(image,(max(1,round(image.shape[1]*scale)),max(1,round(image.shape[0]*scale))),interpolation=cv2.INTER_AREA) if scale<1 else image

def write_image(path,image):
 parameters=[cv2.IMWRITE_WEBP_QUALITY,90] if path.suffix=='.webp' else [cv2.IMWRITE_PNG_COMPRESSION,3]
 if not cv2.imwrite(str(path),image,parameters):raise OSError('Image output failed.')

def seam_diagnostics(stars):
 gray=cv2.cvtColor(stars,cv2.COLOR_BGR2GRAY).astype(np.float32);seams=[];neighbors=[]
 for axis,extent in [(0,stars.shape[0]),(1,stars.shape[1])]:
  for position in range(STRIDE-PAD,extent-3,STRIDE):
   values=np.moveaxis(gray,axis,0);seams.append(float(np.abs(values[position]-values[position-1]).mean()))
   neighbors.extend(float(np.abs(values[p]-values[p-1]).mean()) for p in [position-3,position+3] if p>0)
 a,b=float(np.mean(seams)) if seams else 0.,float(np.mean(neighbors)) if neighbors else 0.
 return dict(boundaryMeanCodeGradient=a,nearbyMeanCodeGradient=b,ratio=a/b if b else None,meaning='Diagnostic of residual gradients at buffer publication boundaries; not an astronomical quality guarantee.')

def run(request):
 started=time.perf_counter();required={'schema','operation','source','model','outputDirectory'}
 if not isinstance(request,dict) or not required<=set(request) or set(request)-required-{'baseline'} or request['schema']!='cssearth-star-removal@1' or request['operation'] not in ['preview','apply']:raise ValueError('Invalid NOX work request.')
 emit('validating',0,1,'Verifying pinned native image, model and baseline')
 source_path=read_pin(request['source'],True);model_path=read_pin(request['model']);baseline_path=read_pin(request['baseline']) if request.get('baseline') else None
 output=Path(request['outputDirectory'])
 if not output.is_absolute() or '.local' not in output.parts or output.resolve() in [source_path.parent.resolve(),model_path.parent.resolve()] or output.resolve()==source_path.resolve():raise ValueError('Outputs require a distinct absolute ignored directory.')
 image=decode(source_path);h,w=image.shape[:2]
 if [w,h]!=request['source']['nativeDimensions']:raise ValueError('Native source dimensions differ.')
 baseline=decode(baseline_path) if baseline_path else None
 if baseline is not None and (baseline.shape!=image.shape or np.any(baseline>image)):raise ValueError('Baseline changed the native grid or adds pixels.')
 output.mkdir(parents=True,exist_ok=True);emit('validating',1,1,'Source pins and native pixel grid verified');emit('loading-model',0,1,'Loading NOX once for this job');predict=Nox(model_path);emit('loading-model',1,1,'NOX ready')
 result=dict(schema='cssearth-nox-output@1',operation=request['operation'],sourceSha256=request['source']['sha256'],modelSha256=sha(request['model']['path']),scriptSha256=sha(__file__),baselineSha256=request.get('baseline',{}).get('sha256'),nativeDimensions=[w,h])
 try:
  overview=reduced(image,1600);write_image(output/'overview.webp',overview);result['overview']=dict(path='overview.webp',dimensions=[overview.shape[1],overview.shape[0]])
  if request['operation']=='preview':
   cases=automatic_origins(image);result['previews']=[]
   for index,(identity,label,(x,y),size) in enumerate(cases):
    crop=image[y:y+size,x:x+size];tile=tile_at(image,x,y);predicted=predict([tile])[0][:size,:size];removed,stars,mask=positive_union(crop,predicted,None if baseline is None else baseline[y:y+size,x:x+size])
    row=dict(id=identity,label=label,origin=[x,y],width=size,height=size)
    for name,pixels in [('source',crop),('removed',removed),('stars',stars),('mask',mask)]:row[name]=identity+'-'+name+'.png';write_image(output/row[name],pixels)
    result['previews'].append(row);emit('previews',index+1,len(cases),f'Prepared automatic native crop {index+1} of {len(cases)}')
  else:
   diffuse,stars,mask,tiling=tiled_remove(image,predict,baseline)
   verification=dict(maximumReconstructionErrorCodeValues=0,changedPixelsOutsideMask=0,baselineRestoredPixels=0,encodedRoundTripExact=True,coverageComplete=tiling['coverageComplete'])
   if not np.array_equal(diffuse.astype(np.uint16)+stars,image) or np.any(np.any(diffuse!=image,axis=2)&(mask==0)) or (baseline is not None and np.any(diffuse>baseline)):raise AssertionError('Native positive accounting failed.')
   names=dict(diffuse='diffuse.png',stars='stars.png',mask='mask.png')
   for index,(name,pixels) in enumerate([('diffuse.png',diffuse),('stars.png',stars),('mask.png',mask)]):
    emit('encoding',index,3,f'Writing verified native {name}');write_image(output/name,pixels);decoded=cv2.imread(str(output/name),cv2.IMREAD_UNCHANGED)
    if not np.array_equal(decoded,pixels):raise AssertionError('PNG round trip changed native pixels.')
    del decoded
   small_diffuse,small_stars=reduced(diffuse,4096),reduced(stars,4096)
   for name,pixels in [('diffuse.webp',small_diffuse),('stars.webp',small_stars),('comparison.webp',np.hstack([reduced(image,600),reduced(diffuse,600),reduced(stars,600)]))]:write_image(output/name,pixels)
   counts=dict(nativePixels=w*h,changedPixels=int(np.count_nonzero(mask)),additionalPixels=int(np.count_nonzero(np.any(diffuse<(image if baseline is None else baseline),axis=2))),tiles=tiling['tiles'])
   result['applied']=dict(images=names,previews=dict(diffuse='diffuse.webp',stars='stars.webp',comparison='comparison.webp'),previewDimensions=[small_diffuse.shape[1],small_diffuse.shape[0]],counts=counts,verification=verification,tiling=tiling,seamDiagnostics=seam_diagnostics(stars))
  result['timing']=dict(modelLoadSeconds=predict.load_seconds,inferenceSeconds=predict.seconds,inferredTiles=predict.tiles,batchSize=BATCH,threads=6)
 finally:predict.close()
 result['elapsedSeconds']=round(time.perf_counter()-started,3);result['artifactSha256']={p.name:sha(p) for p in sorted(output.iterdir()) if p.suffix in ['.png','.webp']}
 temporary=output/'result.json.pending';temporary.write_text(json.dumps(result,indent=2,allow_nan=False)+'\n');temporary.replace(output/'result.json')
 print(json.dumps(dict(type='complete',result=str(output/'result.json'))),flush=True);return result
if __name__=='__main__':run(json.load(sys.stdin))
