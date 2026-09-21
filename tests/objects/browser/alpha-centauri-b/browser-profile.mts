import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/alpha-centauri-b/prepared/controls.json' with {type:'json'};

export const browserProfile=createObjectBrowserProfile({id:'alpha-centauri-b',controls,audit:{canonicalPreparedAssets:['/scenes/alpha-centauri-b/alpha-centauri-b-surface-shape@2x.webp'],retained:{lensIds:['shape'],allowedMountSelectors:[]}}});
