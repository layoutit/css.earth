import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/bergelmir/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bergelmir',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/bergelmir/bergelmir-model-surface@2x.webp','/scenes/bergelmir/bergelmir-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
