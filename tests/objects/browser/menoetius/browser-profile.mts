import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/menoetius/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'menoetius',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/menoetius/menoetius-model-surface@2x.webp','/scenes/menoetius/menoetius-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
