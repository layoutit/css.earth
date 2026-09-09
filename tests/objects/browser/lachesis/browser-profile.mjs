import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/lachesis/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'lachesis',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/lachesis/lachesis-directional-sun.webp",
      "two": "/scenes/lachesis/lachesis-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/lachesis/lachesis-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/lachesis/lachesis-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
