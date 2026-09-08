import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/pallas/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'pallas',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/pallas/pallas-directional-sun.webp",
      "two": "/scenes/pallas/pallas-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/pallas/pallas-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/pallas/pallas-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
