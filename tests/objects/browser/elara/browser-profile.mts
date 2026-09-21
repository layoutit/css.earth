import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/elara/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'elara',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/elara/elara-model-surface@2x.webp','/scenes/elara/elara-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
