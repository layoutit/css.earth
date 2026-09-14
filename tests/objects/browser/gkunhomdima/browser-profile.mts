import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/gkunhomdima/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gkunhomdima',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/gkunhomdima/gkunhomdima-model-surface@2x.webp','/scenes/gkunhomdima/gkunhomdima-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
