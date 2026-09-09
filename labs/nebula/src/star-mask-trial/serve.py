#!/usr/bin/env python3
"""Local native-crop slider trial. Cached neural predictions; no inference in HTTP requests."""
import argparse,functools,json,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse,parse_qs
import cv2,numpy as np

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--assets',default='.local/nebula-lab/star-mask-trial');args=parser.parse_args();assets=Path(args.assets).resolve();index=Path(__file__).with_name('index.html')
 def cases():return {row['id']:row for row in json.loads((assets/'manifest.json').read_text())['cases']}
 @functools.lru_cache(maxsize=12)
 def pixels(identity):
  if identity not in cases():raise ValueError('Unknown case.')
  values=[cv2.imread(str(assets/identity/(name+'.png')),cv2.IMREAD_UNCHANGED) for name in ['original','baseline','nox']]
  if any(v is None or v.shape!=(512,512,3) or v.dtype!=np.uint8 for v in values):raise ValueError('Trial source grids differ.')
  source,baseline,nox=values
  if np.any(baseline>source):raise ValueError('Baseline is not positive removal.')
  return source,source.astype(np.int16)-baseline, np.maximum(0,source.astype(np.int16)-nox)
 @functools.lru_cache(maxsize=64)
 def render(identity,sensitivity,halo,mode):
  source,baseline,positive=pixels(identity);threshold=1+round((100-sensitivity)*254/100)
  support=np.max(positive,axis=2)>=threshold
  if halo:support=cv2.dilate(support.astype(np.uint8),cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(halo*2+1,halo*2+1))).astype(bool)
  support &= np.any(positive>0,axis=2)
  residual=np.maximum(baseline,positive*support[:,:,None]).astype(np.uint8);removed=source-residual;affected=np.any(residual>0,axis=2)
  assert np.array_equal(source.astype(np.uint16),removed.astype(np.uint16)+residual)
  assert np.all(residual>=baseline)
  image=affected.astype(np.uint8)*255 if mode=='mask' else removed if mode=='removed' else residual
  ok,png=cv2.imencode('.png',image,[cv2.IMWRITE_PNG_COMPRESSION,2]);assert ok
  return png.tobytes(),int(affected.sum()),int(np.any(residual>baseline,axis=2).sum())
 class Handler(BaseHTTPRequestHandler):
  def do_GET(self):
   start=time.perf_counter()
   try:
    url=urlparse(self.path)
    if url.path=='/preview':
     q=parse_qs(url.query,strict_parsing=True)
     if set(q)!={'case','sensitivity','halo','mode'} or any(len(v)!=1 for v in q.values()):raise ValueError('Expected case, sensitivity, halo and mode.')
     identity=q['case'][0];sensitivity=int(q['sensitivity'][0]);halo=int(q['halo'][0]);mode=q['mode'][0]
     if not 0<=sensitivity<=100 or not 0<=halo<=8 or mode not in ['mask','removed','stars']:raise ValueError('Invalid preview controls.')
     data,affected,additional=render(identity,sensitivity,halo,mode);content='image/png'
     extra={'X-Affected-Pixels':str(affected),'X-Additional-Pixels':str(additional),'X-Preview-Ms':f'{(time.perf_counter()-start)*1000:.2f}'}
    elif url.path=='/':data=index.read_bytes();content='text/html; charset=utf-8';extra={}
    elif url.path=='/manifest.json':data=(assets/'manifest.json').read_bytes();content='application/json';extra={}
    elif url.path.startswith('/assets/'):
     parts=url.path.split('/')
     if len(parts)!=4 or parts[2] not in cases() or parts[3] not in ['original.png','baseline.png','nox.png']:raise ValueError('Unknown asset.')
     data=(assets/parts[2]/parts[3]).read_bytes();content='image/png';extra={}
    else:self.send_error(404);return
    self.send_response(200);self.send_header('Content-Type',content);self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
    for key,value in extra.items():self.send_header(key,value)
    self.end_headers();self.wfile.write(data)
   except (ValueError,KeyError,FileNotFoundError) as error:self.send_error(400,str(error))
   except (BrokenPipeError,ConnectionResetError):pass
  def log_message(self,*args):pass
 print('NOX_TRIAL_SERVER http://127.0.0.1:4332',flush=True);ThreadingHTTPServer(('127.0.0.1',4332),Handler).serve_forever()
if __name__=='__main__':main()
