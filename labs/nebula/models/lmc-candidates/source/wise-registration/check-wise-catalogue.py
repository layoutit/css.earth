import importlib.util,json,csv,cv2,numpy as np,hashlib
from pathlib import Path
from scipy.ndimage import maximum_filter
from scipy.spatial import cKDTree,ConvexHull
spec=importlib.util.spec_from_file_location('reg','labs/nebula/src/validate-image-registration.py');reg=importlib.util.module_from_spec(spec);spec.loader.exec_module(reg)
p=Path('.local/nebula-lab/image-candidates/wise-registration/catalogue-check');recipe=json.loads(Path('labs/nebula/models/lmc-candidates/source/wise-registration/recipe.json').read_text());src=next(x for x in recipe['targets'][0]['images']if x['id']=='wise-wide-infrared');path=Path(src['path']);im=cv2.imread(str(path));g=im[:,:,0].astype('float32');hp=np.maximum(g-cv2.GaussianBlur(g,(0,0),4),0);yy,xx=np.where((hp==maximum_filter(hp,size=7))&(hp>12));gy,gx=np.mgrid[-1:2,-1:2];stars=[]
for x,y in zip(xx,yy):
 if x<5 or y<5 or x>=g.shape[1]-5 or y>=g.shape[0]-5:continue
 z=hp[y-1:y+2,x-1:x+2];stars.append([float(x+(z*gx).sum()/z.sum()),float(y+(z*gy).sum()/z.sum()),float(hp[y,x])])
stars=np.array(stars);reg.dump(p/'wise-w1-star-centroids.json',{'sourceSha256':reg.sha(path),'coordinateConvention':reg.CONVENTION,'channel':'Blue JPEG channel (CDS W1 display channel)','nativePixelCentres':stars[:,:2].tolist(),'highpassPeak':stars[:,2].tolist(),'method':'Native 6000px blue channel, positive high-pass sigma4; local maxima 7px, threshold12/255; weighted 3x3 centroids'});cv2.imwrite(str(p/'wise-w1-star-map.png'),hp.clip(0,255).astype('uint8'));print('W1_STAR_MAP_EXTRACTED',len(stars),flush=True)
rows=list(csv.DictReader((p/'allwise-bright.csv').open()));assert len(rows)<200000,'Catalogue truncated';sky=np.array([[float(r['ra']),float(r['dec'])]for r in rows]);pred=reg.topix(sky,src['wcs'],g.shape);inside=np.all((pred>10)&(pred<np.array(g.shape[::-1])-10),axis=1);rows=[r for r,b in zip(rows,inside)if b];pred=pred[inside];sky=sky[inside];isolated=cKDTree(pred).query(pred,k=2)[0][:,1]>5;rows=[r for r,b in zip(rows,isolated)if b];pred=pred[isolated];sky=sky[isolated];tree=cKDTree(stars[:,:2]);dist,ii=tree.query(pred);matched=dist<2.5
# Bright isolated catalogue coordinates are external identity anchors; no image transform is fitted.
indices=np.where(matched)[0];order=indices[np.argsort(dist[matched])];seen=set();keep=[]
for k in order:
 if int(ii[k])not in seen:keep.append(k);seen.add(int(ii[k]))
keep=np.array(sorted(keep));x=stars[ii[keep],:2];expected=pred[keep];res=np.linalg.norm(x-expected,axis=1);heldout=np.arange(len(keep))%3==0
controls=[]
for offset in [[40,0],[0,40],[100,-70]]:
 dd,_=tree.query(pred+offset);controls.append({'offsetNativeWisePixels':offset,'matchesWithin2_5Pixels':int((dd<2.5).sum())})
wrong={};center=(np.array(g.shape[::-1])-1)/2
for name,mat in {'mirror-x':np.array([[-1,0],[0,1]]),'mirror-y':np.array([[1,0],[0,-1]]),'rotate90':np.array([[0,-1],[1,0]]),'scale0.9':np.eye(2)*.9,'scale1.1':np.eye(2)*1.1}.items():
 altered=(pred-center)@mat.T+center;dd,_=tree.query(altered);wrong[name]={'matchesWithin2_5Pixels':int((dd<2.5).sum())}
quads=[int(((x[:,0]>=g.shape[1]/2)==bool(qx)) .__and__((x[:,1]>=g.shape[0]/2)==bool(qy)).sum())for qy in[0,1]for qx in[0,1]]
hull=float(ConvexHull(x).volume/(g.shape[0]*g.shape[1]));stats=reg.residual_stats(res);hs=reg.residual_stats(res[heldout]);protocol={'minUniqueMatches':100,'minQuadrants':4,'minHullFraction':.5,'maxMedianNativeWisePixels':.75,'maxP90NativeWisePixels':1.5,'maxEachShiftedControlFraction':.1,'correspondenceWindowNativeWisePixels':2.5,'catalogueIsolationPixels':5,'catalogueMagnitudeRangeW1':[8,11]};gates={'uniqueMatches':len(x)>=100,'allFourQuadrants':all(q>0 for q in quads),'halfImageHull':hull>=.5,'median':hs['median']<=.75,'p90':hs['p90']<=1.5,'shiftedControls':max(q['matchesWithin2_5Pixels']for q in controls)<len(x)*.1};receipt={'schema':'cssearth-fixed-wcs-catalogue-direction-gate@1','pass':all(gates.values()),'gates':gates,'predeclaredProtocol':protocol,'source':{'path':str(path),'sha256':reg.sha(path),'nativeDimensions':list(g.shape[::-1]),'channel':'W1 in JPEG blue channel','wcs':src['wcs']},'catalogue':{'path':str(p/'allwise-bright.csv'),'sha256':reg.sha(p/'allwise-bright.csv'),'name':'IRSA AllWISE Source Catalog allwise_p3as_psd','query':json.loads((p/'query.json').read_text()),'downloadedRows':len(list(csv.DictReader((p/'allwise-bright.csv').open()))),'inFieldIsolatedCandidates':len(rows),'selection':'8<=W1<=11, W1 SNR>30, ext_flg=0, W1 cc_flags=0; >5 image pixels from another selected catalogue object'},'coordinateConvention':reg.CONVENTION,'refitted':False,'uniqueMatchedStars':len(x),'allCoordinatesHeldOutFromAnyFit':True,'reservedCheckCount':int(heldout.sum()),'residualNativeWisePixels':stats,'reservedCheckResidualNativeWisePixels':hs,'matchedSourceHullFraction':hull,'quadrantMatchCounts':quads,'shiftedControls':controls,'wrongTransformControls':wrong,'cloudProcessingPerformed':False,'limitations':['Catalogue and image originate from the same infrared survey but coordinates are checked independently against the published image WCS.','The JPEG is a 14.6arcsec/pixel display composite; residuals are not native detector astrometric precision.','Blue W1 centroids verify common image geometry, not diffuse W3/W4 photometry, seams, or cloud quality.','Identities are associated within a predeclared 2.5 pixel window; shifted controls measure chance associations.','Fixed publisher WCS is verified without fitting an offset, scale, reflection or homography.']};reg.dump(p/'wise-direction-gate.json',receipt);reg.dump(p/'matched-catalogue-stars.json',{'designation':[rows[k]['designation']for k in keep],'catalogueRaDecDeg':sky[keep].tolist(),'cataloguePredictedNativePixelCentres':expected.tolist(),'detectedNativePixelCentres':x.tolist(),'residualNativeWisePixels':res.tolist(),'reservedCheck':heldout.tolist()});print('WISE_CATALOGUE_GATE',json.dumps({k:receipt[k]for k in['pass','gates','uniqueMatchedStars','reservedCheckCount','residualNativeWisePixels','reservedCheckResidualNativeWisePixels','matchedSourceHullFraction','quadrantMatchCounts','shiftedControls','wrongTransformControls']},indent=2),flush=True)
view=cv2.resize(im,(1500,1500))
for z in expected[heldout]:cv2.circle(view,tuple(np.round(z/4).astype(int)),2,(0,220,255),1)
cv2.imwrite(str(p/'catalogue-overlay.jpg'),view)
choices=[]
for cy in range(5):
 for cx in range(5):
  inds=np.where((np.floor(expected[:,0]/1200)==cx)&(np.floor(expected[:,1]/1200)==cy)&heldout)[0]
  if len(inds):choices.append(int(inds[np.argmin(res[inds])]))
sheet=np.zeros((int(np.ceil(len(choices)/5))*150,1000,3),np.uint8)
for j,k in enumerate(choices):
 row,col=divmod(j,5);patch=cv2.getRectSubPix(im,(40,40),tuple(expected[k].astype(float)));patch=cv2.resize(patch,(140,140),interpolation=cv2.INTER_NEAREST);cv2.drawMarker(patch,(70,70),(0,220,255),cv2.MARKER_CROSS,14,1);sheet[row*150+10:row*150+150,col*200:col*200+140]=patch;cv2.putText(sheet,f'{rows[keep[k]]["designation"]} {res[k]:.2f}px',(col*200,row*150+9),cv2.FONT_HERSHEY_SIMPLEX,.25,(255,255,255),1)
cv2.imwrite(str(p/'catalogue-contact-sheet.jpg'),sheet)
