/** Shared CLI streams and terminal interaction contract. */
export interface CliIo {
  readonly stdinIsTTY:boolean;readonly stdoutIsTTY:boolean;readonly stderrIsTTY?:boolean;
  readonly write:(text:string)=>void;readonly error:(text:string)=>void;
  readonly question:(prompt:string)=>Promise<string|undefined>;readonly flush?:()=>Promise<void>;readonly close:()=>void;
}
