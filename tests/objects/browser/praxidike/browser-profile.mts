import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/praxidike/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'praxidike',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/praxidike/praxidike-model-surface@2x.webp','/scenes/praxidike/praxidike-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
