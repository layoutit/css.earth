import { browserProfileLensIds, createObjectBrowserProfile } from '../../../../site/test/object-browser-profile.mts';
import objectControls from '../../../../src/planets/menoetius/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'menoetius',controls:objectControls,audit:{
  canonicalPreparedAssets:['/scenes/menoetius/menoetius-model-surface@2x.webp','/scenes/menoetius/menoetius-lighting.webp','/scenes/menoetius/menoetius-directional-sun@2x.webp'],
  retained:{lensIds:browserProfileLensIds(objectControls),speedClicks:5,allowedMountSelectors:[]},
}});
