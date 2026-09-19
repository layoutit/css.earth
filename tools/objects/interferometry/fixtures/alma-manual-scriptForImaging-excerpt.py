# Excerpt of scriptForImaging.py as delivered with member observing unit set uid://A001/X2d8/X73
# (project 2015.1.01302.S, Europa, 2015-11-26). Every kept line is verbatim.
finalvis='calibrated_final.ms' # This is your output ms from the data
contspws = '0,1,2,3'
initweights(vis=finalvis,wtmode='weight',dowtsp=True)
contvis='calibrated_final_cont.ms'
split2(vis=finalvis,
     spw=contspws,      
     outputvis=contvis,
     width=[8,8,8,8], 
     datacolumn='data')

field='3' # science field(s). For a mosaic, select all mosaic fields. DO NOT LEAVE BLANK ('') OR YOU WILL TRIGGER A BUG IN CLEAN THAT WILL PUT THE WRONG COORDINATE SYSTEM ON YOUR FINAL IMAGE.
imagermode='csclean' # uncomment if single field
cell='6.25mas' # cell size for imaging.
imsize = [2048,2048] # size of image in pixels.
weighting = 'briggs'
robust=0.5
niter=1000
threshold = '0.0mJy'
contvis = 'calibrated_final_cont.ms'         
contimagename = 'calibrated_final_cont'
clean(vis=contvis,
      imagename=contimagename,
      field=field,
      mode='mfs',
      psfmode='clark',
      imsize = imsize, 
      cell= cell, 
      weighting = weighting, 
      robust = robust,
      niter = niter, 
      multiscale=[0,5,15,30,60,120],
      threshold = threshold, 
      interactive = True,
      imagermode = imagermode)
