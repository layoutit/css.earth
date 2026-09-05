// Preparation-only publisher inventory. This is object availability, not a
// promise that every pixel in a listed COG contains usable imagery.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
export const WORLDCOVER_BUCKET = "https://esa-worldcover-s2.s3.eu-central-1.amazonaws.com/";
export const WORLDCOVER_PREFIX = "rgbnir/2021/";

const decode = value => value.replace(/&(?:quot|apos|amp|lt|gt);/g,
  entity => ({"&quot;":'"',"&apos;":"'","&amp;":"&","&lt;":"<","&gt;":">"})[entity]);

// Deliberately accept only this publisher's flat ListObjectsV2 response, not
// general XML, DTDs or nested data. Reject malformed/duplicate/missing fields.
function fields(xml, allowed) {
  const result = {};
  const remainder = xml.replace(/<([A-Za-z]+)>([^<>]*)<\/\1>/g, (_, name, value) => {
    if (!allowed.includes(name) || Object.hasOwn(result,name) || /&(?!quot;|apos;|amp;|lt;|gt;)/.test(value)) {
      throw new Error("Unsupported WorldCover inventory field.");
    }
    result[name] = decode(value);
    return "";
  });
  if (remainder.trim()) throw new Error("Malformed WorldCover inventory XML.");
  return result;
}

export function worldCoverTileBounds(tile) {
  const match = /^([NS])(\d{2})([EW])(\d{3})$/.exec(tile);
  if (!match) throw new Error("Invalid WorldCover tile id.");
  const south = Number(match[2])*(match[1]==="S"?-1:1);
  const west = Number(match[4])*(match[3]==="W"?-1:1);
  if (south < -90 || south >= 90 || west < -180 || west >= 180 ||
      (south===0&&match[1]==="S") || (west===0&&match[3]==="W")) {
    throw new Error("Noncanonical WorldCover tile id.");
  }
  return {west,east:west+1,south,north:south+1};
}

export function worldCoverTileId(west,south) {
  if (!Number.isInteger(west)||!Number.isInteger(south)) throw new Error("Expected integer source tile coordinates.");
  west=((west+180)%360+360)%360-180;
  const tile=`${south<0?'S':'N'}${String(Math.abs(south)).padStart(2,'0')}${west<0?'W':'E'}${String(Math.abs(west)).padStart(3,'0')}`;
  worldCoverTileBounds(tile);
  return tile;
}

export function worldCoverSourceEntry(entry) {
  worldCoverTileBounds(entry.tile);
  if (!/^[a-f0-9]{32}(?:-\d+)?$/.test(entry.etag) || !Number.isSafeInteger(entry.sourceBytes) || entry.sourceBytes<=0) {
    throw new Error("Invalid WorldCover inventory pin.");
  }
  const key=`${WORLDCOVER_PREFIX}${entry.tile.slice(0,3)}/ESA_WorldCover_10m_2021_v200_${entry.tile}_S2RGBNIR.tif`;
  return {...entry,url:new URL(key,WORLDCOVER_BUCKET).href};
}

export function parseWorldCoverInventory(xml) {
  const root=/^\s*<\?xml version="1\.0" encoding="UTF-8"\?>\s*<ListBucketResult xmlns="http:\/\/s3\.amazonaws\.com\/doc\/2006-03-01\/">([\s\S]*)<\/ListBucketResult>\s*$/.exec(xml);
  if (!root) throw new Error("Unexpected WorldCover inventory envelope.");
  const entries=[];
  const rest=root[1].replace(/<Contents>([\s\S]*?)<\/Contents>/g,(_,body)=>{
    const f=fields(body,["Key","LastModified","ETag","Size","StorageClass"]);
    const match=/^rgbnir\/2021\/([NS]\d{2})\/ESA_WorldCover_10m_2021_v200_([NS]\d{2}[EW]\d{3})_S2RGBNIR\.tif$/.exec(f.Key??"");
    if(!match||match[1]!==match[2].slice(0,3)||!/^"[a-f0-9]{32}(?:-\d+)?"$/.test(f.ETag??"")||
      !/^\d+$/.test(f.Size??"")||!Number.isFinite(Date.parse(f.LastModified))||f.StorageClass!=="STANDARD") {
      throw new Error("Unexpected object in the WorldCover RGBNIR inventory.");
    }
    const entry={tile:match[2],etag:f.ETag.slice(1,-1),sourceBytes:Number(f.Size),lastModified:f.LastModified};
    worldCoverSourceEntry(entry);
    entries.push(entry);
    return "";
  });
  const f=fields(rest,["Name","Prefix","NextContinuationToken","ContinuationToken","KeyCount","MaxKeys","IsTruncated"]);
  if(f.Name!=="esa-worldcover-s2"||f.Prefix!==WORLDCOVER_PREFIX||
    !/^\d+$/.test(f.KeyCount??"")||Number(f.KeyCount)!==entries.length||entries.length>1000||
    !["true","false"].includes(f.IsTruncated)||
    (f.IsTruncated==="true"?!f.NextContinuationToken:Boolean(f.NextContinuationToken))) {
    throw new Error("Incomplete WorldCover inventory page.");
  }
  return {entries,next:f.NextContinuationToken??null};
}

export function sourceTilesForBounds(bounds, catalog) {
  const {west,east,south,north}=bounds;
  if(![west,east,south,north].every(Number.isFinite)||east<=west||east-west>360||
    north<=south||south< -90||north>90)throw new Error("Invalid geographic source bounds.");
  const available=[],unavailable=[],seen=new Set();
  for(let latitude=Math.floor(south);latitude<Math.ceil(north);latitude++) {
    for(let longitude=Math.floor(west);longitude<Math.ceil(east);longitude++) {
      const tile=worldCoverTileId(longitude,latitude),entry=catalog.get(tile);
      if(seen.has(tile))continue;
      seen.add(tile);
      if(entry)available.push(worldCoverSourceEntry(entry));
      else unavailable.push(tile);
    }
  }
  return {available,unavailable};
}

export async function readWorldCoverCatalog({directory=new URL("../../source/city/",import.meta.url)}={}) {
  const pin=JSON.parse(await readFile(new URL("catalog-pin.json",directory),"utf8"));
  if(pin.schema!=="cssearth-worldcover-inventory-pin@1"||pin.path!=="worldcover-rgbnir-2021.json.gz"||
    pin.expectedBytes>1024*1024||pin.expectedDecodedBytes>16*1024*1024)throw new Error("Invalid WorldCover catalog pin.");
  const bytes=await readFile(new URL(pin.path,directory));
  if(bytes.length!==pin.expectedBytes||createHash("sha256").update(bytes).digest("hex")!==pin.expectedSha256) {
    throw new Error("WorldCover catalog snapshot hash mismatch.");
  }
  const decoded=gunzipSync(bytes,{maxOutputLength:16*1024*1024});
  if(decoded.length!==pin.expectedDecodedBytes)throw new Error("WorldCover catalog decoded size mismatch.");
  const snapshot=JSON.parse(decoded);
  if(snapshot.schema!=="cssearth-worldcover-inventory@1"||snapshot.dataset!==pin.dataset||
    snapshot.bucket!==WORLDCOVER_BUCKET||snapshot.prefix!==WORLDCOVER_PREFIX||
    snapshot.entries.length!==pin.tileCount)throw new Error("WorldCover catalog contract mismatch.");
  const entries=new Map();
  let sourceBytes=0;
  for(const entry of snapshot.entries) {
    worldCoverSourceEntry(entry);
    if(entries.has(entry.tile))throw new Error("Duplicate WorldCover catalog tile.");
    entries.set(entry.tile,entry);sourceBytes+=entry.sourceBytes;
  }
  if(sourceBytes!==pin.sourceBytes)throw new Error("WorldCover inventory byte total mismatch.");
  return {pin,entries};
}
