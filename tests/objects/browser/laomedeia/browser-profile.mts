import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/laomedeia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'laomedeia',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/laomedeia/laomedeia-model-surface@2x.webp','/scenes/laomedeia/laomedeia-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
