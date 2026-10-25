/** Qualified DeMCELS H-alpha cutouts, each bounded and checked in its own WCS. */
import {mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import {LOCAL,need} from './inputs.mts';
import {readGas} from './qualify-gas.mts';
const dir=`${LOCAL}versions/inputs/gas/`;await mkdir(dir,{recursive:true});
const fields:[string,number,number][]=[['30dor',84.68,-69.10],['n11',74.17,-66.46],['n44',80.57,-67.95],['n79',72.8,-69.4],['n70',85.96,-67.85],['n63',83.1,-66.6],['ridge',85.0,-70.0],['bar-west',79.0,-69.6],['bar-east',83.0,-69.6],['north',81.5,-66.9],['south',81.5,-71.0],['north-east',86,-67.5]];
const decode=(s:string)=>s.replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>');
async function download(url:string,path:string,cap:number){
  const r=await fetch(url,{signal:AbortSignal.timeout(60000)});need(r.ok&&r.body,`Gas HTTP ${r.status}`);const reader=r.body.getReader(),chunks:Uint8Array[]=[];let n=0;
  while(true){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>cap){await reader.cancel();throw Error('Gas byte cap exceeded');}chunks.push(x.value);}
  const bytes=Buffer.concat(chunks);await writeFile(path,bytes);return bytes;
}
const results=[];
for(const[name,ra,dec]of fields){
  const file=`${dir}${name}.fits`;
  if(await stat(`${file}.qualification.json`).catch(()=>null)){results.push({name,file});continue;}
  const query=`https://datalab.noirlab.edu/sia/demcels_dr1?POS=${ra},${dec}&SIZE=0.45&FORMAT=image/fits`;
  let xml='';try{xml=(await download(query,`${dir}${name}-sia.xml`,1024**2)).toString('utf8');}catch(e){results.push({name,unavailable:true,reason:String(e)});continue;}
  const columns=[...xml.matchAll(/<FIELD\b[^>]*\bname="([^"]+)"/gu)].map(m=>m[1]);
  const rows=[...xml.matchAll(/<TR>([\s\S]*?)<\/TR>/gu)].map(m=>[...m[1].matchAll(/<TD>([\s\S]*?)<\/TD>/gu)].map(x=>decode(x[1])));
  const candidates=rows.map(v=>Object.fromEntries(columns.map((k,i)=>[k,v[i]]))).filter(v=>v.access_url?.includes('.ha_sub_r.'));
  candidates.sort((a,b)=>Math.hypot((Number(a.s_ra)-ra)*Math.cos(dec*Math.PI/180),Number(a.s_dec)-dec)-Math.hypot((Number(b.s_ra)-ra)*Math.cos(dec*Math.PI/180),Number(b.s_dec)-dec));
  let done=false;
  for(const candidate of candidates.slice(0,3))try{
    const url=new URL(candidate.access_url);url.searchParams.set('SIZE','0.3,0.3');
    // The cutout service treats encoded commas as a request for the full tile.
    const request=url.href.replaceAll('%2C',',');
    await download(request,file,64*1024**2);const source=await readGas(file),p=source.projection.pixelOf(ra,dec);
    need(p&&p[0]>=-.5&&p[1]>=-.5&&p[0]<source.image.width-.5&&p[1]<source.image.height-.5,'Requested coordinate is outside this cutout');
    await writeFile(`${file}.qualification.json`,JSON.stringify({...source.summary,sourceUrl:request,requestedSky:[ra,dec],requestedPixel:p,sourceDataset:'DeMCELS DR1 continuum-subtracted H-alpha',linearCounts:true,absoluteFluxCalibration:false},null,2)+'\n');
    results.push({name,file});console.log(JSON.stringify({sentinel:'DEMCELS_FIELD_QUALIFIED',name,dimensions:[source.image.width,source.image.height],bytes:(await stat(file)).size}));done=true;break;
  }catch(e){console.log(JSON.stringify({name,rejected:String(e)}));}
  if(!done)results.push({name,unavailable:true});
  await writeFile(`${dir}index.json`,JSON.stringify(results,null,2)+'\n');
}
console.log(JSON.stringify({sentinel:'DEMCELS_ACQUISITION_COMPLETE',qualified:results.filter(r=>'file'in r).length,total:fields.length}));
