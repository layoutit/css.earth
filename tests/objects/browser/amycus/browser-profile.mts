import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/amycus/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'amycus',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/amycus/amycus-model-surface@2x.webp','/scenes/amycus/amycus-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
