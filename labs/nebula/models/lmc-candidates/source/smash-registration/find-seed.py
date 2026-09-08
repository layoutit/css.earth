import cv2,numpy as np,json,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('reg','labs/nebula/src/validate-image-registration.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
p=Path('.local/nebula-lab/smash-mosaic/registration'); src,sn=r.load('.local/nebula-lab/smash-mosaic/smash-lmc-author-mosaic.jpg',5000);ref,rn=r.load('.local/nebula-lab/source-originals/noirlab2030a.tif',5000)
# Remove diffuse light at every working scale, before descriptor extraction.
for sd,rd in [(4000,2400),(2400,1200),(3500,3500)]:
 def work(im,d):
  a=cv2.resize(im,(round(im.shape[1]*d/max(im.shape)),round(im.shape[0]*d/max(im.shape))),interpolation=cv2.INTER_AREA);g=cv2.cvtColor(a,cv2.COLOR_BGR2GRAY).astype(float);hp=(g-cv2.GaussianBlur(g,(0,0),5)).clip(0,100)*2.55;return hp.astype('uint8')
 s=work(src,sd);a=work(ref,rd);sift=cv2.SIFT_create(nfeatures=60000,contrastThreshold=.004);ka,da=sift.detectAndCompute(a,None)
 for flip in [False,True]:
  ss=cv2.flip(s,1) if flip else s;kb,db=sift.detectAndCompute(ss,None); raw=cv2.BFMatcher().knnMatch(db,da,k=2);m=[x for x,y in raw if x.distance<.9*y.distance];x=np.array([kb[i.queryIdx].pt for i in m]);y=np.array([ka[i.trainIdx].pt for i in m]);H,mask=cv2.findHomography(x,y,cv2.RANSAC,2.5,maxIters=100000,confidence=.999);cnt=int(mask.sum()); print('dims',sd,rd,'flip',flip,'matches',len(m),'inliers',cnt,flush=True)
  if cnt>35:
   if flip:H=H@np.array([[-1.,0.,s.shape[1]-1],[0.,1.,0.],[0.,0.,1.]])
   H=r.resize_matrix(a.shape,ref.shape)@H@r.resize_matrix(src.shape,s.shape);H/=H[2,2];r.dump(p/'independent-seed.json',{'homography':H.tolist(),'rawMatches':len(m),'coherentMatches':cnt,'reflectionRequired':flip,'sourceWorkingDimension':sd,'referenceWorkingDimension':rd,'ratioThreshold':.9});raise SystemExit(0)
raise SystemExit(1)
