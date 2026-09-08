import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/melpomene/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'melpomene',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/melpomene/melpomene-directional-sun.webp",
      "two": "/scenes/melpomene/melpomene-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/melpomene/melpomene-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/melpomene/melpomene-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
