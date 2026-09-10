import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/polydeuces/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'polydeuces',controls:objectControls,audit:{
  preparedAssetPairs:[{one:'/scenes/polydeuces/polydeuces-directional-sun.webp',two:'/scenes/polydeuces/polydeuces-directional-sun@2x.webp'}],
  canonicalPreparedAssets:['/scenes/polydeuces/polydeuces-model-surface@2x.webp','/scenes/polydeuces/polydeuces-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
