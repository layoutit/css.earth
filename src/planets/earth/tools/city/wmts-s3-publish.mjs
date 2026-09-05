import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { WMTS_CACHE_CONTROL } from "./wmts-release.mjs";

export function wmtsS3Environment(delivery, environment=process.env){
  const access=environment.EARTH_R2_ACCESS_KEY_ID,secret=environment.EARTH_R2_SECRET_ACCESS_KEY;
  if(!access&&!secret)return null;
  if(!access||!secret)throw new Error("Incomplete Earth R2 S3 credentials.");
  return {...environment,RCLONE_CONFIG_EARTH_RELEASE_TYPE:"s3",RCLONE_CONFIG_EARTH_RELEASE_PROVIDER:"Cloudflare",
    RCLONE_CONFIG_EARTH_RELEASE_ACCESS_KEY_ID:access,RCLONE_CONFIG_EARTH_RELEASE_SECRET_ACCESS_KEY:secret,
    RCLONE_CONFIG_EARTH_RELEASE_ENDPOINT:`https://${delivery.accountId}.r2.cloudflarestorage.com`,
    RCLONE_CONFIG_EARTH_RELEASE_REGION:"auto",RCLONE_CONFIG_EARTH_RELEASE_NO_CHECK_BUCKET:"true"};
}

export async function publishWmtsS3({assets,directory,delivery,prefix,output,environment}){
  const files=resolve(output,"s3-files.txt"),remote=`earth_release:${delivery.bucket}/${prefix}`;
  await writeFile(files,assets.map(asset=>asset.filename).join("\n")+"\n");
  // Copy only the pinned files, preserving existing immutable keys. Credentials
  // stay in the child environment and never enter arguments, reports or config.
  await run(["copy",directory,remote,"--files-from",files,"--checksum","--immutable",
    "--transfers","32","--checkers","32","--metadata","--metadata-set",`cache-control=${WMTS_CACHE_CONTROL}`,
    "--metadata-set","content-type=application/octet-stream","--stats","15s","--stats-one-line",
    "--stats-log-level","NOTICE"],environment);
  return verifyWmtsS3({assets,delivery,prefix,output,environment});
}

export async function verifyWmtsS3({assets,delivery,prefix,output,environment}){
  const remote=`earth_release:${delivery.bucket}/${prefix}`;
  // S3 lists each single-part ETag and size already. Do not issue one extra
  // metadata request per object just to include unused modification times/MIME.
  const listing=JSON.parse(await run(["lsjson",remote,"--recursive","--files-only",
    "--hash-type","MD5","--no-modtime","--no-mimetype"],environment,true));
  await writeFile(resolve(output,"s3-verification.json"),JSON.stringify(listing,null,2)+"\n");
  verifyWmtsListing(assets,listing);
  return {objects:assets.length,bytes:assets.reduce((sum,a)=>sum+a.bytes,0),verification:"Every pinned local SHA-256 and remote S3 size/MD5 matches; public ranges are verified separately."};
}

export function verifyWmtsListing(assets,listing){
  const byName=new Map(listing.map(entry=>[entry.Path,entry]));
  if(listing.length!==assets.length||byName.size!==assets.length)throw new Error("Published S3 release object count mismatch.");
  for(const asset of assets){
    const entry=byName.get(asset.filename);
    const md5=entry?.Hashes?.md5??entry?.Hashes?.MD5;
    if(!entry||entry.Size!==asset.bytes||md5!==asset.md5)throw new Error(`Published S3 pack mismatch: ${asset.filename}`);
  }
}

function run(args,environment,capture=false){
  return new Promise((accept,reject)=>{
    const child=spawn("rclone",args,{env:environment,stdio:["ignore",capture?"pipe":"inherit","inherit"]});
    const chunks=[];let bytes=0;
    if(capture)child.stdout.on("data",chunk=>{bytes+=chunk.length;if(bytes>32*1024*1024){child.kill("SIGTERM");reject(new Error("S3 listing exceeds the release bound."));return;}chunks.push(chunk)});
    child.once("error",reject);child.once("exit",code=>code===0?accept(capture?Buffer.concat(chunks).toString("utf8"):null):reject(new Error(`rclone exited ${code}.`)));
  });
}
