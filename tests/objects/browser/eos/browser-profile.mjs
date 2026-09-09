import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/eos/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'eos',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/eos/eos-directional-sun.webp",
      "two": "/scenes/eos/eos-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/eos/eos-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/eos/eos-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
