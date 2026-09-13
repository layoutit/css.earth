import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/bebhionn/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'bebhionn',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/bebhionn/bebhionn-model-surface@2x.webp','/scenes/bebhionn/bebhionn-lighting.webp','/scenes/bebhionn/bebhionn-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
