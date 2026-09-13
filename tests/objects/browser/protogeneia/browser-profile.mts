import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/objects/protogeneia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'protogeneia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/protogeneia/protogeneia-directional-sun.webp",
      "two": "/scenes/protogeneia/protogeneia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/protogeneia/protogeneia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/protogeneia/protogeneia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
