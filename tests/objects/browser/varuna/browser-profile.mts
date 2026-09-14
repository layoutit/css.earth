import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/varuna/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'varuna',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/varuna/varuna-model-surface@2x.webp','/scenes/varuna/varuna-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
