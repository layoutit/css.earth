# Excerpt of scriptForImagingPrep.py as delivered with the same member observing unit set. Every kept line is verbatim.
flagdata(vis=vis,mode='manual',action='apply',uvrange='>10km',flagbackup=False)
concatvis = vislist[0]
sourcevis='calibrated_source.ms'
split(vis=concatvis,
      intent='*TARGET*', # split off the target sources
      outputvis=sourcevis,
      datacolumn='data')

