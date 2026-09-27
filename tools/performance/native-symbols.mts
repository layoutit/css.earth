/** Resolve native sample addresses only against binaries with the recorded UUID and load address. */
import { execFile } from 'node:child_process';
import { readdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve, relative } from 'node:path';
import { promisify } from 'node:util';
const exec = promisify(execFile);
const unescape = (value: string) => value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escape = (value: string) => value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function nativeFrameDefinitions(xml: string) {
  const attrs = (value: string) => Object.fromEntries([...value.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1],unescape(m[2]!)]));
  const binaries = new Map([...xml.matchAll(/<binary\s+([^>]+)\/>/g)].map(m => attrs(m[1]!)).filter(b => b.id).map(b => [b.id,b]));
  return [...xml.matchAll(/<frame\s+([^>]+)>([\s\S]*?)<\/frame>/g)].flatMap(m => {
    const frame = attrs(m[1]!), match = /<binary\s+([^>]+)\/>/.exec(m[2]!);
    if (!frame.id || !/^0x[0-9a-f]+$/i.test(frame.name ?? '') || !/^0x[0-9a-f]+$/i.test(frame.addr ?? '') || !match) return [];
    const ref = attrs(match[1]!), binary = binaries.get(ref.ref ?? ref.id ?? '');
    if (!binary?.path || !binary.UUID || !/^[\w-]+$/.test(binary.arch ?? '') || !/^0x[0-9a-f]+$/i.test(binary['load-addr'] ?? '')) return [];
    return [{id:frame.id,name:frame.name!,address:frame.addr!,binary}];
  });
}
export async function symbolicateNativeXml(xml: string, nativePath: string) {
  const frames = nativeFrameDefinitions(xml), groups = new Map<string, typeof frames>();
  for (const frame of frames) { const key = `${frame.binary.UUID}:${frame.binary['load-addr']}`; const group = groups.get(key) ?? []; group.push(frame); groups.set(key,group); }
  const support = join(homedir(),'Library/Developer/Xcode/iOS DeviceSupport');
  const roots = (await readdir(support).catch(()=>[])).map(name => join(support,name,'Symbols'));
  const names = new Map<string,string>(), evidence: unknown[] = [];
  for (const group of groups.values()) {
    const binary = group[0]!.binary;
    let matched: string | null = null;
    for (const root of roots) {
      const file = resolve(root, '.'+binary.path);
      if (relative(root,file).startsWith('..') || !(await stat(file).catch(()=>null))?.isFile()) continue;
      const uuid = await exec('xcrun',['dwarfdump','--uuid',file],{timeout:10000,maxBuffer:1024*1024}).then(r=>r.stdout,()=> '');
      if (!uuid.toUpperCase().includes(`UUID: ${binary.UUID!.toUpperCase()} (`)) continue;
      matched = file; break;
    }
    if (!matched) { evidence.push({uuid:binary.UUID,path:binary.path,status:'matching binary unavailable'}); continue; }
    const addresses = [...new Set(group.map(frame=>frame.address))];
    const resolved = new Map<string,string>();
    for(let i=0;i<addresses.length;i+=512) {
      const batch=addresses.slice(i,i+512);
      const output=await exec('xcrun',['atos','-o',matched,'-arch',binary.arch!,'-l',binary['load-addr']!,...batch],{timeout:20000,maxBuffer:8*1024*1024}).then(r=>r.stdout,()=> '');
      const lines=output.trim().split('\n');
      if(lines.length!==batch.length)continue;
      batch.forEach((address,index)=>{const name=lines[index]!.trim();if(name && !/^0x[0-9a-f]+(?:\s|$)/i.test(name))resolved.set(address,name);});
    }
    for(const frame of group) { const name=resolved.get(frame.address); if(name)names.set(frame.id,name); }
    evidence.push({uuid:binary.UUID,path:binary.path,symbolFile:matched,loadAddress:binary['load-addr'],addresses:addresses.length,resolved:resolved.size});
  }
  await writeFile(join(dirname(nativePath),'native-symbols.json'),JSON.stringify({unknownFrames:frames.length,resolvedFrames:names.size,binaries:evidence},null,2)+'\n');
  return xml.replace(/<frame\s+([^>]+)>/g,(full,attributes: string)=>{
    const id=/\bid="([^"]+)"/.exec(attributes)?.[1], name=id?names.get(id):undefined;
    return name?full.replace(/\bname="[^"]*"/,`name="${escape(name)}"`):full;
  });
}
