import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/belinda/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'belinda',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/belinda/belinda-model-surface@2x.webp','/scenes/belinda/belinda-lighting.webp','/scenes/belinda/belinda-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
