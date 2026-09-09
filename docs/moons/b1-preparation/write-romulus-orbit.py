import json, math, pathlib, hashlib, shutil, os, xml.etree.ElementTree as ET
from datetime import datetime, timezone
TMP=pathlib.Path(os.environ.get('CSSEARTH_ROMULUS_RECEIPTS', '/tmp/moons-b1-romulus-orbit'))
ROOT=pathlib.Path(__file__).resolve().parents[3]
BODY=ROOT/'src/planets/romulus';OUT=BODY/'source/orbit';VAL=BODY/'source/validation';DOC=ROOT/'docs/moons/b1-preparation'
for d in [OUT,VAL,DOC]:d.mkdir(parents=True,exist_ok=True)
def write(path,obj):path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+'\n')
def sha(b):return hashlib.sha256(b).hexdigest()
def copy_pin(src,dst):
 b=(TMP/src).read_bytes();(OUT/dst).write_bytes(b)
 return {'path':'source/orbit/'+dst,'url':(TMP/(src+'.url')).read_text().strip(),'sha256':sha(b),'bytes':len(b)}
pins={
 'miriadeSolutions':copy_pin('solutions.txt','miriade-solutions.txt'),
 'miriade2018':copy_pin('projection-2018.xml','miriade-2018.xml'),
 'miriade2026':copy_pin('projection-2026.xml','miriade-2026.xml'),
 'geocentric2018':copy_pin('geocentric-2018.txt','geocentric-2018.txt'),
 'geocentric2026':copy_pin('geocentric-2026.txt','geocentric-2026.txt'),
 'geocentricAstrometry':copy_pin('geocentric-astrometry.txt','geocentric-astrometry.txt'),
 'paperAstrometry':copy_pin('tablec1.dat','paper-astrometry.dat'),
 'paperAstrometryReadme':copy_pin('cds-readme.txt','paper-astrometry-readme.txt'),
 'parent':copy_pin('parent-state.txt','sylvia-heliocentric.txt')}
pins['parent'].update({'target':87,'targetKind':'numbered-asteroid','center':10,'solution':'JPL#130','requestEpochJdUtc':2461286.499199259,'ttMinusUtcSeconds':69.184})
pdf=(TMP/'published-extracted.pdf').read_bytes()
paper={'citation':'Carry et al. (2021), Astronomy & Astrophysics 650 A129, Table 3, page 5','doi':'10.1051/0004-6361/202140342','url':'https://www.aanda.org/articles/aa/pdf/2021/06/aa40342-21.pdf','retrievalUrl':(TMP/'published.pdf.url').read_text().strip(),'sha256':sha(pdf),'bytes':len(pdf),'md5':hashlib.md5(pdf).hexdigest(),'checksumCrossCheck':'Clean payload MD5 matches Caltech published-file record 5a2c92a0a091e4fda304148226eb772c.','retrievalTransformation':'Institutional mirror returned multipart form-data. Extracted bytes from %PDF through %%EOF and its LF; no scientific content transformed. Full paper is not bundled.','versionComparison':'Published page 5 visually inspected; all Table 3 Romulus elements and uncertainties agree with arXiv:2103.06349v1. Table 1 lists 143 observations while Table 3 and CDS Table C1 contain 130; retain Table 3 membership.'}
P=3.64126;a=1340.6;tp=2455597.08689
params={'schema':'cssearth-published-mutual-orbit@1','id':'romulus','centerBodyId':'sylvia','referenceFrame':'EQJ2000','epochJd':tp,'timeScale':'TT','timeScaleQualification':'Table 3 labels tp as JD without a time scale. TT is an explicit preparation convention; the CDS observed timestamps are UTC. Choosing UTC instead would shift this phase by about one minute, smaller than the quoted 0.10085-day epoch uncertainty, but this does not establish a source-owned exact time scale.','semiMajorAxisKm':a,'eccentricity':0,'inclinationDegrees':7.4,'ascendingNodeDegrees':97.1,'argumentPeriapsisDegrees':171,'meanAnomalyDegrees':0,'meanMotionDegreesPerDay':360/P,'quadraticMeanAnomalyDegreesPerYear2':0,'periodDays':P,'source':paper,'uncertainties':{'confidence':'All Table 3 uncertainties are 3 sigma. Parameter covariance is not supplied.','periodDays':.00005,'semiMajorAxisKm':1.2,'eccentricity':{'minus':0,'plus':.009},'inclinationDegrees':1.6,'ascendingNodeDegrees':5.8,'argumentPeriapsisDegrees':10.5,'epochDays':.10085},'sourceObservations':{'table3Count':130,'table3SpanDays':6050,'table3ReportedRmsMas':9.85,'cdsTableC1Count':130,'cdsFirstUtc':'2002-05-07T09:37:02.42','cdsLastUtc':'2018-11-29T04:41:40.71'},'qualifications':['Nominal circular Kepler orbit from printed elements. For e=0, argument of periapsis and pericenter epoch are individually degenerate; retain their published combination as the phase convention.','EQJ2000 is adopted as ICRF for this low-precision illustration; frame-bias milliarcseconds are negligible compared with measured source-projection disagreements.','No precession, perturbation or current phase correction is added. Runtime receives only the exact prepared epoch snapshot.','The paper fit RMS is not reproduced by the rounded-element illustration and must not be used as its accuracy claim.','Modern Miriade solution 1 is independently checked, not silently substituted or used to fit a correction.'], 'gravityPolicy':'The effective combined GM is derived from the selected a and P: 4π²a³/(P·86400)². Body GM=0 denotes unmodeled satellite mass; assigning the combined value to the parent is a preparation convention, not a measurement of individual masses.','publishedMassesKg':{'sylvia':{'value':1.440e19,'uncertainty3Sigma':.004e19},'romulus':{'value':1.4e15,'uncertainty3Sigma':1.2e15},'qualification':'Paper describes satellite mass as effectively an upper limit; these values are retained separately from the effective two-body GM.'}}
params['timeQualification']=params['timeScaleQualification']
params['citation']=params['source']
write(OUT/'published-parameters.json',params)
inc,O,w=map(math.radians,[7.4,97.1,171]);n=2*math.pi/P
basisX=[math.cos(O)*math.cos(w)-math.sin(O)*math.sin(w)*math.cos(inc),math.sin(O)*math.cos(w)+math.cos(O)*math.sin(w)*math.cos(inc),math.sin(w)*math.sin(inc)]
basisY=[-math.cos(O)*math.sin(w)-math.sin(O)*math.cos(w)*math.cos(inc),-math.sin(O)*math.sin(w)+math.cos(O)*math.cos(w)*math.cos(inc),math.cos(w)*math.sin(inc)]
def state(jd):
 m=n*(jd-tp)
 return [a*(x*math.cos(m)+y*math.sin(m)) for x,y in zip(basisX,basisY)],[a*n*(-x*math.sin(m)+y*math.cos(m)) for x,y in zip(basisX,basisY)]
def horizon(name):
 text=(TMP/name).read_text();out=[]
 for line in text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
  c=line.split(',');v=list(map(float,c[2:11]));out.append({'jdUtc':float(c[0]),'positionKm':v[:3],'velocityKmPerDay':v[3:6],'lightTimeDays':v[6]})
 return out
MAS=180/math.pi*3600000
def projection(jdTt,geo,retarded=True):
 r=geo['positionKm'];d=math.hypot(*r);ra=math.atan2(r[1],r[0]);dec=math.asin(r[2]/d)
 east=[-math.sin(ra),math.cos(ra),0];north=[-math.cos(ra)*math.sin(dec),-math.sin(ra)*math.sin(dec),math.cos(dec)]
 t=jdTt-geo['lightTimeDays'] if retarded else jdTt
 p,v=state(t)
 return [sum(x*y for x,y in zip(p,axis))/d*MAS for axis in [east,north]]
comparisons=[];ns={'v':'http://www.ivoa.net/xml/VOTable/v1.3'}
for label in ['2018','2026']:
 xml=ET.parse(TMP/f'projection-{label}.xml');table=xml.find('.//v:TABLE[@ID="Romulus_1"]',ns);rows=[[float(c.text) if c.text else None for c in row] for row in table.findall('.//v:TR',ns)]
 for geo,row in zip(horizon(f'geocentric-{label}.txt'),rows):
  tt=geo['jdUtc']+69.184/86400;pred=projection(tt,geo);expected=row[1:3];res=[x-y for x,y in zip(pred,expected)];residual=math.hypot(*res)
  comparisons.append({'label':label,'epochJdTt':tt,'responseTableJd':row[0],'geocentricLightTimeDays':geo['lightTimeDays'],'emissionEpochJdTt':tt-geo['lightTimeDays'],'miriadePositionMas':expected,'publishedModelPositionMas':pred,'differenceMas':res,'differenceMagnitudeMas':residual,'skyPlaneDifferenceKm':residual/MAS*math.hypot(*geo['positionKm']),'projectionPositionAngleDifferenceDegrees':((math.degrees(math.atan2(pred[1],pred[0])-math.atan2(expected[1],expected[0]))+180)%360)-180,'miriadeUncertaintyAvailable':any(v is not None for v in row[3:]),'sourcePins':['miriade'+label,'geocentric'+label]})
observations=json.loads((TMP/'selected-astrometry.json').read_text());paperChecks=[]
for obs,geo,offset in zip(observations,horizon('geocentric-astrometry.txt'),[64.184,64.184,66.184,66.184,69.184,69.184]):
 tt=geo['jdUtc']+offset/86400;pred=projection(tt,geo);expected=[x-y for x,y in zip(obs['observedMas'],obs['reportedObservedMinusComputedMas'])]
 paperChecks.append(obs|{'epochJdTt':tt,'ttMinusUtcSeconds':offset,'geocentricLightTimeDays':geo['lightTimeDays'],'reportedModelPositionMas':expected,'publishedPrintedElementsPositionMas':pred,'differenceMagnitudeMas':math.hypot(*(x-y for x,y in zip(pred,expected))),'comparisonKind':'Independent historical coordinate/projection consistency check. These are the source fit observations, not an independent scientific holdout.'})
sourcePath=OUT/'published-parameters.json';b=sourcePath.read_bytes();p,v=state(2461286.5);gm=4*math.pi**2*a**3/(P*86400)**2
limits=['This is an extrapolation of rounded 2021 published elements to 2026-09-03, beyond the retained 2002–2018 astrometry; current phase is approximate.','The full model covariance and an explicit time scale for the printed pericenter epoch are absent. Quoted independent parameter uncertainties must not be treated as a scene covariance.','The six independent Miriade 2024-solution projections differ by 23–63 mas, including about 42 mas (140 km on the sky plane) at the scene epoch; this is measured disagreement, not a guaranteed error bound.','The printed parameters differ from six reported paper-fit positions by 7–62 mas with the documented geometric projection. The paper’s 9.85 mas fit RMS is not achieved or asserted for this illustration.','Miriade permits orbit computation from 1990 to 2030, but its position-error service stops at 2026-Jan-01; empty errors at this scene date are unavailable, not zero.','Sky-plane checks do not independently determine the line-of-sight component, and geocentric projection omits observatory parallax and differential aberration.','No current phase offset is fitted; no continuous runtime ephemeris or out-of-epoch propagation is supported.']
parent=horizon('parent-state.txt')[0]
validation={'model':'Independent primary-source sky-plane comparisons; quantitative disagreement is retained, not calibrated away.','projectionMethod':'Right-handed Rz(Omega) Rx(i) Rz(omega) rotation of the circular Kepler plane. Compare Romulus minus Sylvia against local east/north using JPL geocentric LT-corrected ICRF line of sight, range, and Romulus at TT minus parent light time.','miriadeSolution':'Genoide solution1, 2024-01-16T21:19:51.861, Kepler; reported fit FOM9.42mas belongs to this service model.','miriadeEpochSemantics':'Request declares TT and Requested Epoch is the requested TT calendar, but returned table JD numerically equals UTC (TT−69.184s); preserve both and associate by requested epoch.','comparisonCount':len(comparisons),'comparisons':comparisons,'maxDifferenceMas':max(x['differenceMagnitudeMas'] for x in comparisons),'scientificPrecisionQualified':False,'publishedFitReproduction':{'comparisonCount':len(paperChecks),'comparisons':paperChecks,'maxDifferenceMas':max(x['differenceMagnitudeMas'] for x in paperChecks),'qualification':'Raw printed orbital elements do not reproduce the paper-reported computed astrometry at the quoted fit RMS. Do not equate parameter transcription/parsing correctness with faithful reproduction of the authors’ fit.'},'orbitalPoleCrossCheck':{'fromElementsRaDecDegrees':[7.1,82.6],'paperRaDecDegrees':[7,83],'paperUncertainty3SigmaDegrees':[6,2]},'periodOnlyScenePhaseSensitivityDegrees':360*(2461286.5-tp)*.00005/P**2,'epochOnlyPhaseSensitivityDegrees':360*.10085/P,'parameterUncertaintyQualification':'Sensitivities vary one parameter at a time by its quoted 3 sigma; correlations are unknown, so neither is a joint confidence bound.'}
record={'schema':'cssearth-published-body-epoch-ephemeris@1','id':'romulus','centerBodyId':'sylvia','epochJdTt':2461286.5,'referenceFrame':'ICRF','units':'KM-D','correction':'NONE','solution':'Carry et al. 2021 Table3 printed circular Kepler orbit','source':{'path':'source/orbit/published-parameters.json','sha256':sha(b),'bytes':len(b)},'positionKm':p,'velocityKmPerDay':v,'gravitationalParametersKm3PerS2':{'body':0,'parent':gm,'combined':gm},'gravityQualification':params['gravityPolicy'],'parentHeliocentricState':{'positionKm':parent['positionKm'],'velocityKmPerDay':parent['velocityKmPerDay']},'parentHeliocentricSource':pins['parent'],'validation':validation,'sourcePins':pins,'limitations':limits,'runtimeExtrapolation':False}
write(VAL/'epoch-state.json',record)
write(VAL/'projection-checks.json',{'schema':'cssearth-romulus-projection-checks@1','validation':validation,'sources':pins,'limits':limits})
report=f'''# Romulus orbit preparation

The package retains a fixed scene from the published circular Kepler model. Its current phase is approximate. The printed elements do not reproduce the precision of the authors’ full fit, and no fitted phase correction has been invented.

## Selected source and identity

Carry et al. (2021), A&A 650 A129, [Table 3, page 5]({paper['url']}), supplies Romulus relative to (87) Sylvia in EQJ2000: a={a}km, e=0, i=7.4°, Ω=97.1°, ω=171°, tp={tp}JD and P={P}days. Uncertainties in the parameter file are all **3σ**, with no covariance. The nominal circular orbit uses the published ω/tp combination; neither is separately meaningful when e=0.

The published 15-page PDF was retrieved from the [Tampere University author repository]({paper['retrievalUrl']}) and page5 inspected visually. The mirror includes a multipart wrapper; extracting the PDF yields {len(pdf):,}bytes, SHA256`{sha(pdf)}`, MD5`{hashlib.md5(pdf).hexdigest()}`. That MD5 exactly matches the published file in the [Caltech author record](https://authors.library.caltech.edu/records/q80wm-zzs37). All Romulus Table3 values match arXiv2103.06349v1. Table1 says143observations, while Table3 and the released [CDS TableC1]({pins['paperAstrometry']['url']}) contain130; this discrepancy is retained, not merged into a fictitious dataset.

## Epoch, frame, gravity

The output is geometric ICRF, kilometres and kilometres/day, at **JD2461286.5 TT (2026-09-03)**. The printed tp lacks an explicit time scale, so TT is an adopted preparation convention. CDS observation times are explicitly UTC and are converted with the applicable TT−UTC offsets for comparisons. EQJ2000 is treated as ICRF at the limited precision supported here.

The effective combined GM is **{gm:.15f}km³/s²**, derived from `4π²a³/(P·86400)²`. Individual masses are not used as precise values: the paper calls Romulus's mass effectively an upper limit. `body:0` means unmodeled satellite mass and `parent:combined` is an implementation convention; it is not a measured zero or measured mass allocation. Published masses remain in the parameter receipt.

## Independent checks and limits

- The element-derived orbital pole is RA7.1°, Dec82.6°, consistent with the independently tabulated pole RA7±6°, Dec83±2° (3σ).
- Six [Miriade](https://ssp.imcce.fr/webservices/miriade/api/ephemsys/) projections cover three2018 epochs and the scene date plus twofollowing days. The returned service solution is dated2024-01-16. Differences from the published model are **{min(x['differenceMagnitudeMas'] for x in comparisons):.2f}–{max(x['differenceMagnitudeMas'] for x in comparisons):.2f}mas**, with **{comparisons[3]['differenceMagnitudeMas']:.2f}mas / {comparisons[3]['skyPlaneDifferenceKm']:.1f}km on the sky plane** at the scene epoch. These are measured differences, not an uncertainty guarantee. Source URLs, raw responses, selected numbers and transformations are pinned.
- The Miriade request and response metadata sayTT, but the table JD is numerically UTC; both are recorded. No time offset is applied to improve agreement. Empty uncertainty fields at the scene date mean unavailable: the declared covariance interval ends2026-Jan-01, although orbit-computation availability extends to2030.
- Six independently projected 2002–2018 observations from CDS TableC1 differ from its reported computed positions by **{min(x['differenceMagnitudeMas'] for x in paperChecks):.2f}–{max(x['differenceMagnitudeMas'] for x in paperChecks):.2f}mas**. A geocentric, light-time-corrected projection does not exactly recover the author fit from printed elements. Telescope parallax and differential aberration are omitted. The paper's9.85mas RMS and Miriade's9.42mas FOM do not qualify this model.
- The published period error alone yields a{validation['periodOnlyScenePhaseSensitivityDegrees']:.2f}° phase sensitivity by the scene date; tp uncertainty alone yields{validation['epochOnlyPhaseSensitivityDegrees']:.2f}°. These are separate one-parameter sensitivities with unknown correlations, not a joint3σ region.
- No future runtime propagation is allowed. The fixed snapshot supports an approximate source-informed orbital context, not exact current phase, observational pointing, or occultation prediction.

`source/validation/epoch-state.json` is ready for the generic published-model reader. `source/validation/projection-checks.json` preserves the independent evidence. Parent heliocentric geometry comes from pinned JPL#130 Sylvia against the Sun, queried at the UTC instant corresponding to the scene TT epoch.

The reproducible extraction/check writer is `docs/moons/b1-preparation/write-romulus-orbit.py`; it expects the small retained receipts and the privately cached published PDF in `/tmp/moons-b1-romulus-orbit`. Full scientific articles are not redistributed in the package.
'''
(DOC/'romulus-orbit.md').write_text(report)
print(json.dumps({'state':p,'velocity':v,'gm':gm,'projectionRangeMas':[min(x['differenceMagnitudeMas'] for x in comparisons),max(x['differenceMagnitudeMas'] for x in comparisons)],'sceneDifferenceKm':comparisons[3]['skyPlaneDifferenceKm'],'paperFitRangeMas':[min(x['differenceMagnitudeMas'] for x in paperChecks),max(x['differenceMagnitudeMas'] for x in paperChecks)]}))
