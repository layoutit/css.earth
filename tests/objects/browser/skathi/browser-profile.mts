import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/skathi/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'skathi',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/skathi/skathi-model-surface@2x.webp','/scenes/skathi/skathi-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
