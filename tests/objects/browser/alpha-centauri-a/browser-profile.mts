import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/alpha-centauri-a/prepared/controls.json' with {type:'json'};

export const browserProfile=createObjectBrowserProfile({id:'alpha-centauri-a',controls,audit:{canonicalPreparedAssets:['/scenes/alpha-centauri-a/alpha-centauri-a-surface-shape@2x.webp'],retained:{lensIds:['shape'],allowedMountSelectors:[]}}});
