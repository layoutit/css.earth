// Real 0.2.1 mock answers, trimmed to the rows and evidence these screen tests read.
import type { PaperSearch } from '../../papers.mts';
import type { LeadSearch } from '../../simulations/leads.mts';
import type { StarSurvey } from '../../stars/stars.mts';

export const papers = {
  "schema": "cssearth-telescope-papers@1",
  "target": {
    "id": "betelgeuse",
    "name": "Betelgeuse"
  },
  "names": [
    "Betelgeuse",
    "Alpha Orionis",
    "HD 39801",
    "HD39801"
  ],
  "instrument": null,
  "query": "https://export.arxiv.org/api/query?search_query=%28all%3A%22Betelgeuse%22+OR+all%3A%22Alpha+Orionis%22+OR+all%3A%22HD+39801%22+OR+all%3A%22HD39801%22%29&start=0&max_results=50",
  "source": "arxiv",
  "candidates": 50,
  "requests": 42,
  "works": [
    {
      "rank": 1,
      "title": "Is Betelgeuse the Outcome of a Past Merger?",
      "year": 2020,
      "doi": "https://doi.org/10.3847/1538-4357/ab91bb",
      "authors": [
        "E. Chatzopoulos",
        "Juhan Frank",
        "Dominic C. Marcello"
      ],
      "moreAuthors": true,
      "licence": null,
      "openAccessUrl": "https://arxiv.org/pdf/2005.04172",
      "arxiv": "https://arxiv.org/abs/2005.04172",
      "access": {
        "status": "fetchable",
        "reason": "arXiv preprint 2005.04172 read as HTML (ar5iv); the published text may differ",
        "httpStatus": 200,
        "finalUrl": "https://ar5iv.labs.arxiv.org/html/2005.04172",
        "format": "text/html"
      },
      "captions": [
        {
          "kind": "figure",
          "label": "Figure 5",
          "text": "Figure 5: Evolution of the non–rotating and rotating merger (“M”) models in the Hertzsprung–-Russell diagram for ZAMS primary and secondary mass of 15 M⊙ and 1 M⊙ accordingly (q= 0.07; left panel). The 3- σ observed location of Betelgeuse is also marked for comparison. The colorbar shows the corres…"
        },
        {
          "kind": "figure",
          "label": "Figure 6",
          "text": "Figure 6: Evolution of the non–rotating and rotating merger (“M”) models in the Hertzsprung–-Russell diagram for ZAMS primary and secondary mass of 17 M⊙ and 3 M⊙ accordingly (q= 0.18; left panel). The 3- σ observed location of Betelgeuse is also marked for comparison. The colorbar shows the corres…"
        }
      ],
      "evidence": 10
    },
    {
      "rank": 2,
      "title": "Betelgeuse, the Prototypical Red Supergiant",
      "year": 2025,
      "doi": "https://doi.org/10.3390/galaxies13030050",
      "authors": [
        "Andrea K. Dupree",
        "Miguel Montargès"
      ],
      "moreAuthors": false,
      "licence": null,
      "openAccessUrl": "https://arxiv.org/pdf/2507.15966",
      "arxiv": "https://arxiv.org/abs/2507.15966",
      "access": {
        "status": "fetchable",
        "reason": "arXiv preprint 2507.15966 read as HTML (ar5iv); the published text may differ",
        "httpStatus": 200,
        "finalUrl": "https://ar5iv.labs.arxiv.org/html/2507.15966",
        "format": "text/html"
      },
      "captions": [],
      "evidence": 7
    }
  ]
} satisfies PaperSearch;

export const leads = {
  "schema": "cssearth-telescope-leads@1",
  "target": {
    "id": "betelgeuse",
    "name": "Betelgeuse"
  },
  "names": [
    "Betelgeuse",
    "Alpha Orionis",
    "HD 39801",
    "HD39801"
  ],
  "leads": [
    {
      "doi": "10.5281/zenodo.15059638",
      "url": "https://doi.org/10.5281/zenodo.15059638",
      "kind": "data",
      "publisher": "Zenodo",
      "year": 2025,
      "title": "Projection of asteroid (319) Leona for the time of Betelgeuse occultation on 12 December 2023",
      "description": "Sky projections of asteroid (319) Leona for the time of Betelgeuse occultation on 12 December 2023 (JD 2460290.55258, light time corrected). There are silhouettes for the convex (silhouette) and the nonconvex (silouette_nc) models published by Durech et al. (2025), Shape and spin-state model of tumbling asteroid (319) Leona, Astronomy and Astrophysics. Equatorial north is up, west to the right. The two columns are (u,v) coordinates in kilometers.",
      "license": "cc-by-4.0",
      "class": "eclipse",
      "inTitle": true
    },
    {
      "doi": "10.48550/arxiv.2406.14704",
      "url": "https://doi.org/10.48550/arxiv.2406.14704",
      "kind": "paper",
      "publisher": "arXiv",
      "year": 2024,
      "title": "Single-photon gig in Betelgeuse's occultation",
      "description": "We present results from the occultation of Betelgeuse by asteroid (319) Leona on December 12, 2023, observed using a 64x64 pixel Single-Photon Avalanche Diode (SPAD) array mounted on a 10-inch telescope at the AstroCamp Observatory in Nerpio, Southeast of Spain, just a few kilometers from the center of the occultation shadow path. This study highlights remarkable advancements in applying SPAD technology in astronomy. The SPAD array's asynchronous readout capacity and photon-counting timestamp mode enabled a temporal resolution of 1 microsecond in our light curve observations of Betelgeuse. Our data analysis addressed challenges inherent to SPAD arrays, such as optical cross-talk and afterpulses, which typically cause the photon statistics to deviate from a Poisson distribution. By adopting a generalized negative binomial distribution for photon statistics, we accurately describe the observational data. This method yielded an optical cross-talk estimation of 1.07% in our SPAD array and confirmed a negligible impact of spurious detected events due to afterpulses. The meticulous statistical examination of photon data underscores our SPAD-array's exceptional performance in conducting precise astronomical observations. The observations revealed a major decrease in Betelgeuse's intensity by 77.78% at the occultation's peak, allowing us to measure Betelgeuse's angular diameter at 57.26 mas in the SDSS g-band. This measurement, employing a simplified occultation model and considering the known properties of Leona, demonstrates the potential of SPAD technology for astronomy and sets a new standard for observing ultra-rapid transient celestial events, providing a valuable public dataset for the astronomical community. 7 pages, 4 figures",
      "license": "cc-by-4.0",
      "class": "eclipse",
      "inTitle": true
    }
  ]
} satisfies LeadSearch;

export const stars = {
  "schema": "cssearth-telescope-stars@1",
  "target": {
    "id": "lmc",
    "name": "LMC"
  },
  "simbad": {
    "name": "NAME LMC",
    "raDeg": 80.89416666666666,
    "decDeg": -69.75611111111111,
    "majorAxisArcmin": 322.82666,
    "radiusDeg": 2.6902221666666666
  },
  "objects": 195152,
  "stars": 177014,
  "classes": [
    {
      "id": "cepheid",
      "label": "Cepheids",
      "count": 3055,
      "papers": [
        {
          "bibcode": "2015AcA....65..297S",
          "title": "The OGLE Collection of Variable Stars. Classical Cepheids in the Magellanic System.",
          "stars": 2866,
          "url": "https://ui.adsabs.harvard.edu/abs/2015AcA....65..297S",
          "catalogue": null
        },
        {
          "bibcode": "2008AcA....58..163S",
          "title": "The Optical Gravitational Lensing Experiment. The OGLE-III catalog of variable stars. I. Classical Cepheids in the Large Magellanic Cloud.",
          "stars": 2748,
          "url": "https://ui.adsabs.harvard.edu/abs/2008AcA....58..163S",
          "catalogue": null
        },
        {
          "bibcode": "2022MNRAS.512..563R",
          "title": "The VMC survey - XLVIII. Classical cepheids unveil the 3D geometry of the LMC.",
          "stars": 2734,
          "url": "https://ui.adsabs.harvard.edu/abs/2022MNRAS.512..563R",
          "catalogue": null
        }
      ]
    }
  ],
  "transients": [
    {
      "one": "nova",
      "label": "novae",
      "count": 23
    }
  ],
  "leads": [
    {
      "class": "cepheid",
      "bibcode": "2008AcA....58..163S",
      "table": "J/AcA/58/163/list",
      "positions": "table",
      "command": "telescope new-object --from-table cepheid:lmc=J/AcA/58/163/list --out SPEC.json"
    },
    {
      "class": "cepheid",
      "bibcode": "2008AcA....58..163S",
      "table": "J/AcA/58/163/catalog",
      "positions": "table",
      "command": "telescope new-object --from-table cepheid:lmc=J/AcA/58/163/catalog --out SPEC.json"
    }
  ],
  "others": [],
  "works": []
} satisfies StarSurvey;
