import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/cyrene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'cyrene',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/cyrene/cyrene-directional-sun.webp",
      "two": "/scenes/cyrene/cyrene-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/cyrene/cyrene-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/cyrene/cyrene-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
