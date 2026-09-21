import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/elatus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'elatus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/elatus/elatus-model-surface@2x.webp','/scenes/elatus/elatus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
