const ENDPOINT = "https://mapproxy.terrascope.be/mapproxy/service";
const LAYER = "esa-worldcover-s2rgbnir-10m-2021-v2_tcc";
const REQUIRED = { SERVICE:"WMS", VERSION:"1.3.0", REQUEST:"GetMap", LAYERS:LAYER,
  STYLES:"", CRS:"CRS:84", FORMAT:"image/png", TRANSPARENT:"TRUE" };

// Validate prepared request metadata; never derive a bbox or image in runtime.
export function isPreparedWmsImage(page) {
  if (page.rasterSource !== "terrascope-wms@1") return false;
  let url;
  try { url = new URL(page.url); } catch { return false; }
  if (`${url.origin}${url.pathname}` !== ENDPOINT || url.username || url.password || url.hash) return false;
  if ([...url.searchParams].length !== 11 || Object.entries(REQUIRED).some(([key,value])=>url.searchParams.get(key)!==value)) return false;
  if (![page.width,page.height].every(value=>Number.isSafeInteger(value)&&value>=1&&value<=1040) ||
    url.searchParams.get("WIDTH")!==String(page.width) || url.searchParams.get("HEIGHT")!==String(page.height)) return false;
  const bbox = (url.searchParams.get("BBOX") ?? "").split(",").map(Number);
  return bbox.length===4 && bbox.every(Number.isFinite) && bbox[0]>=-180 && bbox[2]<=180 &&
    bbox[1]>=-85.0511287798066 && bbox[3]<=85.0511287798066 && bbox[0]<bbox[2] && bbox[1]<bbox[3];
}

export async function readWmsImage(response, page) {
  if (response.headers.get("content-type")?.split(";")[0].trim() !== "image/png") {
    throw new Error("WMS response is not a PNG image.");
  }
  // A service response has no pinned byte count. Bound compressed transfer as
  // well as decoded residency, and reject WMS XML exceptions even on HTTP 200.
  const maximumBytes = page.width*page.height*4 + 65536;
  const reader = response.body.getReader();
  const parts=[];
  let received=0;
  try {
    for (;;) {
      const {done,value}=await reader.read();
      if(done)break;
      received+=value.byteLength;
      if(received>maximumBytes)throw new Error("WMS image exceeds its prepared transfer bound.");
      parts.push(value);
    }
  } catch(error) { await reader.cancel().catch(()=>{}); throw error; }
  finally { reader.releaseLock(); }
  return new Blob(parts,{type:"image/png"});
}
