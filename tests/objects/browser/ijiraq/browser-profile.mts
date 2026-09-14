import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/ijiraq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'ijiraq',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/ijiraq/ijiraq-model-surface@2x.webp','/scenes/ijiraq/ijiraq-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
