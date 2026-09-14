import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/siarnaq/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'siarnaq',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/siarnaq/siarnaq-model-surface@2x.webp','/scenes/siarnaq/siarnaq-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
