import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/bianca/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bianca',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/bianca/bianca-directional-sun.webp',two:'/scenes/bianca/bianca-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/bianca/bianca-model-surface@2x.webp','/scenes/bianca/bianca-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
