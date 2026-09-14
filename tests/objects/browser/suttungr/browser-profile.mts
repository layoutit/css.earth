import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/suttungr/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'suttungr',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/suttungr/suttungr-model-surface@2x.webp','/scenes/suttungr/suttungr-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
