import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/taygete/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'taygete',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/taygete/taygete-model-surface@2x.webp','/scenes/taygete/taygete-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
