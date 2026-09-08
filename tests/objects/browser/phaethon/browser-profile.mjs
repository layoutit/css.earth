import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mjs';
import controls from '../../../../src/planets/phaethon/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'phaethon',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/phaethon/phaethon-directional-sun.webp",
      "two": "/scenes/phaethon/phaethon-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/phaethon/phaethon-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/phaethon/phaethon-elevation-shadow@2x.webp",
    "preReadyDisabled": true
  }
}});
