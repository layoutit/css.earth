import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/caliban/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'caliban',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/caliban/caliban-model-surface@2x.webp','/scenes/caliban/caliban-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
