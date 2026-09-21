import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/psamathe/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'psamathe',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/psamathe/psamathe-model-surface@2x.webp','/scenes/psamathe/psamathe-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
