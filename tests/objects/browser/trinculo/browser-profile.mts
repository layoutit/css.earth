import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/trinculo/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'trinculo',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/trinculo/trinculo-model-surface@2x.webp','/scenes/trinculo/trinculo-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
