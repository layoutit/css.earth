# Excerpt of uid___A002_Xad2439_Xee6.ms.scriptForCalibration.py, the manual reduction script ALMA delivered with
# member observing unit set uid://A001/X2d8/X73 (project 2015.1.01302.S, Europa, 2015-11-26). Only the steps
# tools/objects/interferometry/alma-manual-calibration.mts replays are kept; every kept line is verbatim.
step_title = {0: 'Import of the ASDM',
              1: 'Fix of SYSCAL table times',
              2: 'listobs',
              3: 'A priori flagging',
              4: 'Generation and time averaging of the WVR cal table',
              5: 'Generation of the Tsys cal table',
              6: 'Generation of the antenna position cal table',
              7: 'Application of the WVR, Tsys and antpos cal tables',
              8: 'Split out science SPWs and time average',
              9: 'Listobs, and save original flags',
              10: 'Initial flagging',
              11: 'Putting a model for the flux calibrator(s)',
              12: 'Save flags before bandpass cal',
              13: 'Bandpass calibration',
              14: 'Save flags before gain cal',
              15: 'Gain calibration',
              16: 'Save flags before applycal',
              17: 'Application of the bandpass and gain cal tables',
              18: 'Split out corrected column',
              19: 'Save flags after applycal'}
if 'applyonly' not in globals(): applyonly = False

if re.search('^4.5.0', casadef.casa_version) == None:

# CALIBRATE_AMPLI: 
# CALIBRATE_ATMOSPHERE: Europa,J1058+0133,J1108+0811
# CALIBRATE_BANDPASS: J1058+0133
# CALIBRATE_FLUX: J1058+0133
# CALIBRATE_FOCUS: 
# CALIBRATE_PHASE: J1108+0811
# CALIBRATE_POINTING: J1058+0133
# OBSERVE_CHECK: J1116+0829
# OBSERVE_TARGET: Europa

# Using reference antenna = DV19
# Import of the ASDM
mystep = 0
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  if os.path.exists('uid___A002_Xad2439_Xee6.ms') == False:
    importasdm('uid___A002_Xad2439_Xee6', asis='Antenna Station Receiver Source CalAtmosphere CalWVR CorrelatorMode SBSummary', bdfflags=True, lazy=False, process_caldevice=False)
  if applyonly != True: es.fixForCSV2555('uid___A002_Xad2439_Xee6.ms')

# Fix of SYSCAL table times
# A priori flagging
mystep = 3
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  flagdata(vis = 'uid___A002_Xad2439_Xee6.ms',
    mode = 'manual',
    spw = '5~12,17~24',
    autocorr = T,
    flagbackup = F)
  
  flagdata(vis = 'uid___A002_Xad2439_Xee6.ms',
    mode = 'manual',
    intent = '*POINTING*,*ATMOSPHERE*',
    flagbackup = F)
  
  flagcmd(vis = 'uid___A002_Xad2439_Xee6.ms',
    inpmode = 'table',
    useapplied = True,
    action = 'plot',
    plotfile = 'uid___A002_Xad2439_Xee6.ms.flagcmd.png')
  
  flagcmd(vis = 'uid___A002_Xad2439_Xee6.ms',
    inpmode = 'table',
    useapplied = True,
    action = 'apply')
  

# Application of the WVR, Tsys and antpos cal tables
mystep = 7
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  
  
  from recipes.almahelpers import tsysspwmap
  tsysmap = tsysspwmap(vis = 'uid___A002_Xad2439_Xee6.ms', tsystable = 'uid___A002_Xad2439_Xee6.ms.tsys', tsysChanTol = 1)
  
  
  
  applycal(vis = 'uid___A002_Xad2439_Xee6.ms',
    field = '0',
    spw = '17,19,21,23',
    gaintable = ['uid___A002_Xad2439_Xee6.ms.tsys', 'uid___A002_Xad2439_Xee6.ms.wvr', 'uid___A002_Xad2439_Xee6.ms.antpos'],
    gainfield = ['0', '', ''],
    interp = 'linear,linear',
    spwmap = [tsysmap,[],[]],
    calwt = T,
    flagbackup = F)
  
  
  
  applycal(vis = 'uid___A002_Xad2439_Xee6.ms',
    field = '1',
    spw = '17,19,21,23',
    gaintable = ['uid___A002_Xad2439_Xee6.ms.tsys', 'uid___A002_Xad2439_Xee6.ms.wvr', 'uid___A002_Xad2439_Xee6.ms.antpos'],
    gainfield = ['1', '', ''],
    interp = 'linear,linear',
    spwmap = [tsysmap,[],[]],
    calwt = T,
    flagbackup = F)
  
  
  
  # Note: J1116+0829 didn't have any Tsys measurement, so I used the one made on Europa. This is probably Ok.
  
  applycal(vis = 'uid___A002_Xad2439_Xee6.ms',
    field = '2',
    spw = '17,19,21,23',
    gaintable = ['uid___A002_Xad2439_Xee6.ms.tsys', 'uid___A002_Xad2439_Xee6.ms.wvr', 'uid___A002_Xad2439_Xee6.ms.antpos'],
    gainfield = ['3', '', ''],
    interp = 'linear,linear',
    spwmap = [tsysmap,[],[]],
    calwt = T,
    flagbackup = F)
  
  
  
  applycal(vis = 'uid___A002_Xad2439_Xee6.ms',
    field = '3',
    spw = '17,19,21,23',
    gaintable = ['uid___A002_Xad2439_Xee6.ms.tsys', 'uid___A002_Xad2439_Xee6.ms.wvr', 'uid___A002_Xad2439_Xee6.ms.antpos'],
    gainfield = ['3', '', ''],
    interp = 'linear,linear',
    spwmap = [tsysmap,[],[]],
    calwt = T,
    flagbackup = F)
  
  
  
  if applyonly != True: es.getCalWeightStats('uid___A002_Xad2439_Xee6.ms') 
  

# Split out science SPWs and time average
mystep = 8
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  os.system('rm -rf uid___A002_Xad2439_Xee6.ms.split') 
  os.system('rm -rf uid___A002_Xad2439_Xee6.ms.split.flagversions') 
  split(vis = 'uid___A002_Xad2439_Xee6.ms',
    outputvis = 'uid___A002_Xad2439_Xee6.ms.split',
    datacolumn = 'corrected',
    spw = '17,19,21,23',
    keepflags = T)
  
  

print "# Calibration"

# Initial flagging
mystep = 10
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  # Flagging shadowed data
  
  flagdata(vis = 'uid___A002_Xad2439_Xee6.ms.split',
    mode = 'shadow',
    flagbackup = F)
  
  # Flagging edge channels
  
  flagdata(vis = 'uid___A002_Xad2439_Xee6.ms.split',
    mode = 'manual',
    spw = '0:0~7;120~127,1:0~7;120~127,2:0~7;120~127,3:0~7;120~127',
    flagbackup = F)
  
  

# Putting a model for the flux calibrator(s)
mystep = 11
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  setjy(vis = 'uid___A002_Xad2439_Xee6.ms.split',
    standard = 'manual',
    field = 'J1058+0133',
    fluxdensity = [3.32983224433, 0, 0, 0],
    spix = -0.49298049649,
    reffreq = '233.0GHz')
  
  


# Application of the bandpass and gain cal tables
mystep = 17
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  for i in ['0']: # J1058+0133
    applycal(vis = 'uid___A002_Xad2439_Xee6.ms.split',
      field = str(i),
      gaintable = ['uid___A002_Xad2439_Xee6.ms.split.bandpass', 'uid___A002_Xad2439_Xee6.ms.split.phase_int', 'uid___A002_Xad2439_Xee6.ms.split.flux_inf'],
      gainfield = ['', i, i],
      interp = 'linear,linear',
      calwt = T,
      flagbackup = F)
  
  applycal(vis = 'uid___A002_Xad2439_Xee6.ms.split',
    field = '1,2~3', # Europa,J1116+0829
    gaintable = ['uid___A002_Xad2439_Xee6.ms.split.bandpass', 'uid___A002_Xad2439_Xee6.ms.split.phase_inf', 'uid___A002_Xad2439_Xee6.ms.split.flux_inf'],
    gainfield = ['', '1', '1'], # J1108+0811
    interp = 'linear,linear',
    calwt = T,
    flagbackup = F)
  

# Split out corrected column
mystep = 18
if(mystep in thesteps):
  casalog.post('Step '+str(mystep)+' '+step_title[mystep],'INFO')
  print 'Step ', mystep, step_title[mystep]

  os.system('rm -rf uid___A002_Xad2439_Xee6.ms.split.cal') 
  os.system('rm -rf uid___A002_Xad2439_Xee6.ms.split.cal.flagversions') 
  split(vis = 'uid___A002_Xad2439_Xee6.ms.split',
    outputvis = 'uid___A002_Xad2439_Xee6.ms.split.cal',
    datacolumn = 'corrected',
    antenna = 'DA*,DV*,PM*&',
    keepflags = T)
  
  

