/** The artifact inspection shape shared by CLI services and their output views. */
import type { ProductSoftware } from '@cssearth/objects';
import type { DeliveryContext } from './delivery/delivery-context.mts';
import type { OutputChoice } from './delivery/outputs.mts';
import type { FamilyOperation } from './family-handler.mts';
import type { SourceProcessingSoftware } from './products/source-product-contract.mts';
import type { SourceRelevance } from './products/source-relevance.mts';

export interface InspectedArtifact {
  readonly artifact:string;readonly target?:unknown;readonly source:unknown;readonly productReceipt?:string;readonly sourceContext?:DeliveryContext;
  readonly outputs:readonly OutputChoice[];readonly terminal?:boolean;readonly profiles?:readonly {readonly handlerId:string;readonly profileId:string}[];readonly issues?:readonly string[];readonly familyOperations?:readonly FamilyOperation[];readonly relevance?:SourceRelevance;readonly software?:readonly ProductSoftware[];readonly sourceProcessing?:readonly SourceProcessingSoftware[];
}
