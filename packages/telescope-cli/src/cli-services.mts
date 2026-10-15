/** The services the command runs through; tests and the interactive screens inject their own. */
import type { DownloadInfo } from './cli-consent.mts';
import type { InspectedArtifact } from './cli-artifact-types.mts';
import type { exportSpatialObject } from './delivery/spatial-handoff.mts';
import type { exportHtml } from './delivery/html-outputs.mts';
import type { exportOutput } from './delivery/outputs.mts';
import type { projectOutput } from './delivery/projection.mts';
import type { exportSphere } from './sphere/sphere.mts';
import type { familyCoverageLedger } from './family-handlers.mts';
import type { executeFamilyOperation } from './family-operation.mts';
import type { importLocalArtifact } from './local-import.mts';
import type { saveExploration } from './session.mts';
import type { DeliveryContext } from './delivery/delivery-context.mts';
import type { RequestSatisfaction } from './requests/request-satisfaction.mts';
import type { ExploreServices } from './tui/explore.mts';

export interface RetrievedResult {
  readonly resultPath:string;readonly product:string;readonly reused:boolean;
  readonly context?:DeliveryContext;readonly satisfaction?:RequestSatisfaction;
}
export interface CliServices {
  readonly exploration?: ExploreServices;
  readonly getDownloadPlan?:(directory:string,pick:number)=>Promise<DownloadInfo>;
  readonly importLocalArtifact:typeof importLocalArtifact;
  readonly familyCoverageLedger:typeof familyCoverageLedger;
  readonly saveExploration:typeof saveExploration;
  readonly getSession:(root:string,directory:string,pick:number,progress:(text:string)=>void,api?:undefined,options?:{readonly offline?:boolean;readonly out?:string})=>Promise<RetrievedResult>;
  readonly listArtifactOutputs:(path:string,structure?:string)=>Promise<InspectedArtifact>;
  readonly exportHtml?:typeof exportHtml;
  readonly exportOutput:typeof exportOutput;
  readonly projectOutput:typeof projectOutput;
  readonly exportSphere:(recordPath:string,outputDirectory:string)=>ReturnType<typeof exportSphere>;
  readonly exportSpatialObject:typeof exportSpatialObject;
  readonly executeFamilyOperation:typeof executeFamilyOperation;
}
