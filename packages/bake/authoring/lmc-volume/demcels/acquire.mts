/** Resume bounded, identity-deduplicated native archive tiles. */
import {readFile,writeFile} from 'node:fs/promises';
import {json,rec,array,need} from '../inputs.mts';
import {versionDir} from '../sequence-state.mts';
import {retrieveNative,reduceNative,saveReduced,reducedComplete,NATIVE_CAP} from './native.mts';
const dir=versionDir(35)+'inputs/',record=rec(await json(dir+'discovery.json'));
need(record.complete===true,'Complete discovery before bulk transfer');
const rows=array(record.tiles).map(rec),limit=Number(process.argv.find(v=>v.startsWith('--limit='))?.split('=')[1]??rows.length);
need(Number.isInteger(limit)&&limit>0&&limit<=rows.length,'Invalid transfer limit');
need(rows.length*NATIVE_CAP<140*1024**3,'Native cache exceeds 140 GiB envelope');
const results:Record<string,unknown>[]=[],started=performance.now();let next=0;
async function worker(){while(next<limit){const row=rows[next++];need(typeof row.id==='string'&&/^LMC_[A-Za-z0-9_]+\.ha_sub_r\.dr01\.fits$/.test(row.id)&&typeof row.access_url==='string'&&typeof row.s_ra==='string'&&typeof row.s_dec==='string','Invalid archive tile identity');
 const url=new URL(row.access_url);need(url.origin==='https://datalab.noirlab.edu'&&url.pathname==='/svc/cutout'&&url.searchParams.get('siaRef')===row.id,'Unexpected archive source binding');url.searchParams.set('POS',row.s_ra+','+row.s_dec);url.searchParams.set('SIZE','0.7,0.7');const path=dir+'native/'+row.id;
 let result:Record<string,unknown>={id:row.id,url:url.href};for(let round=0;round<2;round++)try{const transfer=await retrieveNative(url.href,path);if(!await reducedComplete(path)){const source=await reduceNative(path);await saveReduced(path,source);}const metadata=rec(JSON.parse(await readFile(path+'.json','utf8')));result={id:row.id,url:url.href,attempts:round+1,...transfer,width:metadata.width,height:metadata.height,coveredBins:metadata.coveredBins,complete:true};break;}catch(e){result={...result,complete:false,error:String(e),attempts:round+1};}
 results.push(result);console.log(JSON.stringify({sentinel:'NATIVE_TILE_FINISHED',done:results.length,total:limit,...result}));
 }}
await Promise.all([worker(),worker(),worker(),worker(),worker(),worker(),worker(),worker()]);
await writeFile(dir+'acquisition.json',JSON.stringify({tiles:results,totalDiscovered:rows.length,requested:limit,seconds:(performance.now()-started)/1000,complete:results.length===limit,failed:results.filter(r=>r.complete!==true).length},null,2)+'\n');
console.log(JSON.stringify({sentinel:'NATIVE_ACQUISITION_COMPLETE',tiles:results.length,failed:results.filter(r=>r.complete!==true).length}));
