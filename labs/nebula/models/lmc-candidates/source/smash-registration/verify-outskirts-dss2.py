import importlib.util,json,cv2,numpy as np
from pathlib import Path
from scipy.spatial import cKDTree,ConvexHull
spec=importlib.util.spec_from_file_location('reg','labs/nebula/src/validate-image-registration.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
p=Path('.local/nebula-lab/smash-mosaic/registration');g=json.loads((p/'direction-gate.json').read_text());H=np.array(g['verifiedRegistration']['imageToReferenceMatrix']).reshape(3,3);rw=g['reference']['wcs'];smshape=g['reference']['nativeDimensions'][::-1];recipe=json.loads(Path('labs/nebula/models/image-overlays.json').read_text());dss=next(x for x in recipe['targets'][0]['images']if x['id']=='dss2-wide-optical');dw=dss['wcs'];s,sn=r.load(g['source']['path'],5000);d,dn=r.load(dss['path'],5000);sp,sh=r.extract(s);dp,dh=r.extract(d)
def chain(x):return r.topix(r.tosky(r.transform(x,H),rw,smshape),dw,d.shape)
corners=np.array([[-.5,-.5],[sn[1]-.5,-.5],[sn[1]-.5,sn[0]-.5],[-.5,sn[0]-.5]]);Hd,_=cv2.findHomography(corners,chain(corners),0);pred=chain(sp[:,:2]);tree=cKDTree(dp[:,:2]);dist,ix=tree.query(pred);eligible=(dist<2.5)&np.all((pred>40)&(pred<np.array(d.shape[1::-1])-40),axis=1);x=sp[eligible,:2];y=dp[ix[eligible],:2];score=r.pattern_scores(sh,dh,x,y,Hd);good=score>.35;x,y,score=x[good],y[good],score[good];ids=ix[eligible][good];keep=[];seen=set()
for i in np.argsort(score)[::-1]:
 if int(ids[i])not in seen:keep.append(i);seen.add(int(ids[i]))
x,y,score=x[keep],y[keep],score[keep];native_dss_y=r.transform(y,r.resize_matrix(d.shape,dn));nativepred=r.transform(chain(x),r.resize_matrix(d.shape,dn));res=np.linalg.norm(native_dss_y-nativepred,axis=1);sm=r.transform(x,H);outer=np.any((sm<0)|(sm>=np.array(smshape[::-1])),axis=1);controls=[]
for offset in [[40,0],[0,40],[100,-70]]:
 pp=pred+offset;dd,jj=tree.query(pp);near=(dd<2.5)&np.all((pp>40)&(pp<np.array(d.shape[1::-1])-40),axis=1);hh=np.array([[1.,0,offset[0]],[0,1.,offset[1]],[0,0,1.]])@Hd;sc=r.pattern_scores(sh,dh,sp[near,:2],dp[jj[near],:2],hh);controls.append({'offsetWorkingDssPixels':offset,'nearbyCandidates':int(near.sum()),'confirmedPatterns':int((sc>.35).sum())})
report={'schema':'cssearth-image-external-star-check@1','source':g['source'],'reference':{'path':dss['path'],'sha256':r.sha(dss['path']),'nativeDimensions':list(dn[1::-1]),'wcs':dw},'coordinateConvention':r.CONVENTION,'matrixSourceToSmashFixed':H.ravel().tolist(),'refitted':False,'allMatches':len(x),'outsideSmashReferenceMatches':int(outer.sum()),'allResidualNativeDssPixels':r.residual_stats(res),'outsideSmashResidualNativeDssPixels':r.residual_stats(res[outer])if outer.any()else None,'matchedSourceHullFraction':float(ConvexHull(x).volume/(sn[0]*sn[1])),'negativeControls':controls,'limitations':['No positions from DSS2 were used to fit the source-to-SMASH homography.','DSS2 photographic point-source centroids and lower image resolution limit expected agreement; no new homography is fitted.','Outside-SMASH subset is outside the entire smaller SMASH reference rectangle.','This checks image registration only, not simulated particle morphology.']}
report['pass']=len(x)>100 and outer.sum()>50 and report['allResidualNativeDssPixels']['p90']<2.5 and len(x)>5*max(1,*[a['confirmedPatterns']for a in controls]);r.dump(p/'dss2-outskirts-check.json',report);r.dump(p/'dss2-outskirts-matched-stars.json',{'sourceNativePixelCentres':x.tolist(),'dss2NativePixelCentres':native_dss_y.tolist(),'sourcePredictedDss2NativePixelCentres':nativepred.tolist(),'outsideSmashReference':outer.tolist(),'surroundingPatternCorrelation':score.tolist(),'residualNativeDssPixels':res.tolist()});print(json.dumps({k:v for k,v in report.items()if k not in['source','reference','coordinateConvention','matrixSourceToSmashFixed','limitations']},indent=2),flush=True)
warped=cv2.warpPerspective(s,Hd,(d.shape[1],d.shape[0]));choices=[]
for cy in range(5):
 for cx in range(5):
  ii=np.where((np.floor(x[:,0]/sn[1]*5)==cx)&(np.floor(x[:,1]/sn[0]*5)==cy)&outer)[0]
  if len(ii):choices.append(int(ii[np.argmax(score[ii])]))
sheet=np.zeros((int(np.ceil(len(choices)/4))*180,1280,3),np.uint8)
for j,k in enumerate(choices):
 row,col=divmod(j,4)
 for side,im in enumerate([warped,d]):
  patch=cv2.resize(cv2.getRectSubPix(im,(72,72),tuple(y[k].astype(float))),(160,160));cv2.drawMarker(patch,(80,80),(0,220,255),cv2.MARKER_CROSS,12,1);sheet[row*180+20:row*180+180,col*320+side*160:col*320+(side+1)*160]=patch
 cv2.putText(sheet,f'outer #{k}: mosaic | DSS2 {res[k]:.2f}px',(col*320+3,row*180+14),cv2.FONT_HERSHEY_SIMPLEX,.34,(255,255,255),1)
cv2.imwrite(str(p/'dss2-outskirts-contact-sheet.jpg'),sheet)
