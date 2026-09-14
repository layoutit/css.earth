import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/objects/belinda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'belinda',controls:objectControls,audit:{
  preparedAssetPairs:[],
  canonicalPreparedAssets:['/scenes/belinda/belinda-model-surface@2x.webp','/scenes/belinda/belinda-lighting.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
