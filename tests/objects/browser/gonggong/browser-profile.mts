import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/gonggong/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gonggong',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/gonggong/gonggong-model-surface@2x.webp','/scenes/gonggong/gonggong-lighting.webp','/scenes/gonggong/gonggong-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
