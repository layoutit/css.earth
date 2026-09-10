import type { PreparedPage } from "../../renderers/css/paging/types.ts";
interface ImageEntry { refs: number; controller: AbortController; url: string | null; bytes: number; ready: Promise<string>; }
import { isPreparedWmsImage, readWmsImage } from "./wms-image.mts";
import { isPreparedWmtsImage } from "./wmts-image.mts";

function delay(ms: number,signal: AbortSignal){
  return new Promise<void>((resolve,reject)=>{
    const abort=()=>{clearTimeout(timer);signal.removeEventListener("abort",abort);reject(signal.reason);};
    const timer=setTimeout(()=>{signal.removeEventListener("abort",abort);resolve();},ms);
    signal.addEventListener("abort",abort,{once:true});
    if(signal.aborted)abort();
  });
}

// One in-flight request/blob per provider URL. Decoded page accounting remains
// conservatively per leaf in the renderer. Released URLs are revoked; revisits
// use the ordinary HTTP cache rather than an unbounded application image cache.
export function createApiImageTransport({fetchImage=fetch,wait=delay}: { fetchImage?: typeof fetch; wait?: typeof delay }={}) {
  const entries=new Map<string, ImageEntry>();
  let requests=0,retries=0,sharedAcquisitions=0,activeRequests=0,receivedBytes=0,destroyed=false;
  async function load(entry: ImageEntry,page: PreparedPage): Promise<string>{
    for(let attempt=0;;attempt++){
      let response,retry=false,retryMs=attempt===0?500:1500;
      try{
        requests++;activeRequests++;
        try{response=await fetchImage(page.url,{signal:AbortSignal.any([entry.controller.signal,AbortSignal.timeout(30000)])});}
        finally{activeRequests--;}
        if(response.ok){
          const blob=await readWmsImage(response,page);
          if(entry.controller.signal.aborted)throw entry.controller.signal.reason;
          receivedBytes+=blob.size;
          entry.bytes=blob.size;
          entry.url=URL.createObjectURL(blob);
          return entry.url;
        }
        retry=response.status===429||response.status===502||response.status===503||response.status===504;
        const after=response.headers.get("retry-after");
        if(after){
          const seconds=Number(after);
          const duration=Number.isFinite(seconds)?seconds*1000:Date.parse(after)-Date.now();
          if(Number.isFinite(duration))retryMs=Math.max(retryMs,duration);
        }
        await response.body?.cancel();
        throw new Error(`Imagery API: HTTP ${response.status}`);
      }catch(error){
        if(entry.controller.signal.aborted)throw error;
        retry ||= error instanceof TypeError||(error instanceof Error && error.name==="TimeoutError");
        if(!retry||attempt>=2||retryMs>30000)throw error;
        retries++;
        await wait(retryMs,entry.controller.signal);
      }
    }
  }
  function remove(key: string,entry: ImageEntry){
    entry.controller.abort();
    if(entry.url)URL.revokeObjectURL(entry.url);
    if(entries.get(key)===entry)entries.delete(key);
  }
  return {
    acquire(page: PreparedPage){
      if(destroyed||!(isPreparedWmsImage(page)||isPreparedWmtsImage(page)))throw new Error("Invalid prepared imagery API request.");
      const key=page.url;
      let entry=entries.get(key);
      if(!entry){
        entry={refs:0,controller:new AbortController(),url:null,bytes:0,ready:Promise.resolve("")};
        entries.set(key,entry);
        entry.ready=load(entry,page);
      }else sharedAcquisitions++;
      entry.refs++;
      let released=false;
      return {ready:entry.ready,release(){if(released)return;released=true;if(--entry.refs===0)remove(key,entry);}};
    },
    stats:()=>({requests,retries,sharedAcquisitions,activeRequests,receivedBytes,
      residentImages:entries.size,residentEncodedBytes:[...entries.values()].reduce((sum,e)=>sum+e.bytes,0)}),
    destroy(){destroyed=true;for(const [key,entry]of entries)remove(key,entry);},
  };
}
