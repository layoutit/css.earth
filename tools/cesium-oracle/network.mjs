import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { sha256 } from './acquire.mjs';

export const imageryPattern='https://mapproxy.terrascope.be/mapproxy/wmts/esa-worldcover-s2rgbnir-10m-2021-v2_tcc/**';

// A bounded recording proxy, shared by both renderers. Replay has zero upstream
// image requests and fails on a missing byte identity. The simulated delay is
// per response, not a claim about real provider or Cloudflare performance.
export async function imageFixture(directory,{mode='record',delayMs=350,maximumImages=2048,maximumBytes=64*1024*1024}={}) {
  await mkdir(directory,{recursive:true});
  const manifestFile=new URL('manifest.json',directory);
  let records={};try{records=JSON.parse(await readFile(manifestFile));}catch(error){if(error.code!=='ENOENT')throw error;}
  let total=Object.values(records).reduce((sum,r)=>sum+r.bytes,0),stopped=false;
  const fetching=new Map(),pending=new Set(),errors=[],deliveries=[];
  const get=async url=>{
    if(records[url]){
      const record=records[url],body=await readFile(new URL(record.sha256+'.png',directory));
      assert.equal(sha256(body),record.sha256,'Recorded imagery hash');assert.equal(body.length,record.bytes,'Recorded imagery bytes');
      return {record,body};
    }
    if(mode==='replay')throw new Error(`Unrecorded oracle imagery: ${url}`);
    if(fetching.has(url))return fetching.get(url);
    if(Object.keys(records).length+fetching.size>=maximumImages)throw new Error('Oracle imagery count bound reached');
    const promise=(async()=>{
      const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
      assert.equal(response.status,200,`Imagery HTTP ${response.status}: ${url}`);
      assert.match(response.headers.get('content-type')??'',/^image\/png/);
      const chunks=[];let size=0;
      for await(const chunk of response.body){size+=chunk.length;assert.ok(size<=327680,'256 pixel PNG transfer envelope');chunks.push(chunk);}
      const body=Buffer.concat(chunks);
      assert.ok(total+body.length<=maximumBytes,'Oracle image byte bound');total+=body.length;
      const record={url,sha256:sha256(body),bytes:body.length,acquiredAt:new Date().toISOString(),headers:Object.fromEntries(['content-type','cache-control','etag','last-modified'].map(k=>[k,response.headers.get(k)]).filter(([,v])=>v!==null))};
      await writeFile(new URL(record.sha256+'.png',directory),body);records[url]=record;
      return {record,body};
    })();fetching.set(url,promise);try{return await promise;}finally{fetching.delete(url);}
  };
  return {errors,deliveries,records,
    async route(context,engine){await context.route(imageryPattern,route=>{
      const work=(async()=>{
        const label=typeof engine==='function'?engine(route):engine;
        const url=route.request().url(),start=Date.now();
        try {
          const {record,body}=await get(url);
          if(stopped)return;
          await new Promise(resolve=>setTimeout(resolve,delayMs));
          if(stopped)return;
          await route.fulfill({status:200,headers:{...record.headers,'cache-control':'public,max-age=86400','access-control-allow-origin':'*','content-type':'image/png'},body});
          deliveries.push({engine:label,url,sha256:record.sha256,bytes:body.length,start,end:Date.now()});
        } catch(error) {
          if(!stopped){errors.push({engine:label,url,error:error.message});await route.abort().catch(()=>{});}
        }
      })();pending.add(work);work.finally(()=>pending.delete(work));return work;
    });},
    async close(){stopped=true;await Promise.allSettled([...pending]);await writeFile(manifestFile,JSON.stringify(records,null,2)+'\n');},
    stats:()=>({mode,delayMs,images:Object.keys(records).length,bytes:total,maximumImages,maximumBytes}),
  };
}

export async function observeNetwork(context,page) {
  const cdp=await context.newCDPSession(page),events=[],requests=new Map();
  await cdp.send('Network.enable');
  let offset=null;
  cdp.on('Network.requestWillBeSent',e=>{
    offset??=e.wallTime*1000-e.timestamp*1000;
    const record={id:e.requestId,frameId:e.frameId,url:e.request.url,method:e.request.method,range:e.request.headers.Range??e.request.headers.range,
      type:e.type,initiator:e.initiator.type,start:e.timestamp*1000+offset,redirect:e.redirectResponse?.status};
    requests.set(e.requestId,record);events.push({type:'request',...record});
  });
  cdp.on('Network.responseReceived',e=>{
    const r=requests.get(e.requestId);if(!r)return;
    Object.assign(r,{status:e.response.status,headersAt:e.timestamp*1000+offset,protocol:e.response.protocol,fromDiskCache:e.response.fromDiskCache,fromServiceWorker:e.response.fromServiceWorker,timing:e.response.timing});
    events.push({type:'headers',...r});
  });
  cdp.on('Network.loadingFinished',e=>{const r=requests.get(e.requestId);if(r){r.end=e.timestamp*1000+offset;r.encodedBytes=e.encodedDataLength;events.push({type:'finished',...r});}});
  cdp.on('Network.loadingFailed',e=>{const r=requests.get(e.requestId);if(r){Object.assign(r,{end:e.timestamp*1000+offset,error:e.errorText,canceled:e.canceled,blockedReason:e.blockedReason});events.push({type:'failed',...r});}});
  return {events,requests,cdp};
}
