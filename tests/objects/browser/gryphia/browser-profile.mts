import {createObjectBrowserProfile} from '../../../../site/test/object-browser-profile.mts';
import controls from '../../../../src/planets/gryphia/prepared/controls.json' with {type:'json'};
export const browserProfile=createObjectBrowserProfile({id:'gryphia',controls,audit:{
  "preparedAssetPairs": [
    {
      "one": "/scenes/gryphia/gryphia-directional-sun.webp",
      "two": "/scenes/gryphia/gryphia-directional-sun@2x.webp"
    }
  ],
  "canonicalPreparedAssets": [
    "/scenes/gryphia/gryphia-shape-surface@2x.webp"
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
    "slowAsset": "/scenes/gryphia/gryphia-elevation-surface@2x.webp",
    "preReadyDisabled": true
  }
}});
