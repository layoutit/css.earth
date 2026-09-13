import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/phaedra/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'phaedra',controls,audit:{
  "canonicalPreparedAssets": [
    "/scenes/phaedra/phaedra-shape-surface@2x.webp",
    "/scenes/phaedra/phaedra-directional-sun@2x.webp"
  ],
  "retained": {
    "lensIds": [
      "shape",
      "elevation"
    ],
    "speedClicks": 5,
    "allowedMountSelectors": []
  },
  "lensRace": {
    "defaultId": "shape",
    "slowId": "elevation",
    "winnerId": "shape",
    "slowAsset": "/scenes/phaedra/phaedra-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
