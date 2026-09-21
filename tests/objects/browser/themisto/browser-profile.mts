import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/themisto/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'themisto',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/themisto/themisto-model-surface@2x.webp','/scenes/themisto/themisto-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
