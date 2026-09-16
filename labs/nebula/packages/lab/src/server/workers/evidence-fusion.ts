import { readFusionRequest } from '../../features/evidence-fusion/jobs-model.ts';
import { prepareFusionPresentation } from '../workflows/evidence-fusion/presentation.ts';
let input='';for await (const chunk of process.stdin) input+=chunk.toString();
const result=await prepareFusionPresentation(process.cwd(),readFusionRequest(JSON.parse(input)),new AbortController().signal,
  message=>process.stdout.write(JSON.stringify({type:'progress',message})+'\n'));
process.stdout.write(JSON.stringify({type:'complete',result})+'\n');
