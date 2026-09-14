import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/sedna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'sedna',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/sedna/sedna-model-surface@2x.webp','/scenes/sedna/sedna-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
