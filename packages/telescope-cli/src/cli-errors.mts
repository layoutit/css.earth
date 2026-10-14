/** Keep transport diagnostics in evidence, and give interrupted downloads one actionable line. */
export function interruptedDownload(error:unknown, resumeCommand?:string):{readonly message:string;readonly rawMessage:string}|undefined {
  const seen=new Set<unknown>();let current=error;
  let recovery:string|undefined;
  while(current instanceof Error&&!seen.has(current)){
    seen.add(current);
    if(current.message.endsWith('; repeat the same fetch with --resume.')) recovery=resumeCommand ? `Resume with: ${resumeCommand}` : 'Repeat the same fetch command with --resume.';
    if(current.message.startsWith('Download interrupted at ')&&'rawMessage' in current&&typeof current.rawMessage==='string')
      return {message:recovery?current.message.split('\n')[0]!.replace('Run the same command again to retry.',recovery):current.message.split('\n')[0]!,rawMessage:current.rawMessage};
    current=current.cause;
  }
  return undefined;
}
