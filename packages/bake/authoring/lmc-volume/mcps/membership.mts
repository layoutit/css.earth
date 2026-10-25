/** Astrometric foreground check, independent of the photograph and MCPS density. */
import {writeFile} from 'node:fs/promises';
import {tapRows} from '@cssearth/telescope-core/node';
import {json,rec,need} from '../inputs.mts';
import {L23,type McpsStar} from './input.mts';
import {L13,GAIA_SERVICE,parseStars,learnMembership,type GaiaStar} from '../gaia-young.mts';
import {member} from '../gaia-old.mts';
export async function membershipSample(){
 const raw=await json(L13+'inputs/calibration.rows.json'),base=parseStars(raw),path=L23+'inputs/foreground.rows.json',query="SELECT TOP 100001 source_id,ra,dec,phot_g_mean_mag,phot_bp_mean_mag,phot_rp_mean_mag,parallax,parallax_error,pmra,pmdec,pmra_error,pmdec_error,parallax_pmra_corr,parallax_pmdec_corr FROM gaiadr3.gaia_source WHERE 1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',81.28,-69.78,5)) AND phot_g_mean_mag<19 AND random_index<20000000 AND parallax_error>0 AND parallax/parallax_error>=5 AND pmra IS NOT NULL AND pmdec IS NOT NULL";
 const request=await json(L23+'inputs/foreground.request.json').then(rec).catch(()=>null);let extra:GaiaStar[];
 if(request?.query===query&&request.complete===true)extra=parseStars(await json(path));else{const rows=await tapRows(GAIA_SERVICE,query,100003,'async');need(rows.length<100001,'Foreground archive query truncated');extra=parseStars(rows);await writeFile(path,JSON.stringify(rows));await writeFile(L23+'inputs/foreground.request.json',JSON.stringify({query,service:GAIA_SERVICE,rows:rows.length,complete:true},null,2)+'\n');}
 const model=learnMembership(base),stars=[...base,...extra],cells=new Map<string,GaiaStar[]>(),scale=3600*Math.cos(70*Math.PI/180),key=(x:number,y:number)=>`${x},${y}`;
 for(const s of stars){const k=key(Math.floor(s.ra*scale),Math.floor(s.dec*3600)),list=cells.get(k)??[];list.push(s);cells.set(k,list);}
 function match(s:McpsStar){const x=Math.floor(s.ra*scale),y=Math.floor(s.dec*3600);let best:GaiaStar|null=null,distance=1;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const g of cells.get(key(x+a,y+b))??[]){const d=Math.hypot((g.ra-s.ra)*3600*Math.cos(s.dec*Math.PI/180),(g.dec-s.dec)*3600);if(d<distance){distance=d;best=g;}}return best?{star:best,member:member(best,model),distance}:null;}
 return{match,summary:{calibrationRows:base.length,addedHighParallaxRows:extra.length,uniformRandomIndexThreshold:20000000,radiusDeg:5,matchRadiusArcsec:1,paper:'https://arxiv.org/html/2012.01771',membership:model}};
}
