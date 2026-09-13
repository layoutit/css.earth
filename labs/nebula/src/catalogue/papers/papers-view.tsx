import { useEffect, useMemo, useState } from 'react';
import type { MessierObject } from '../types';
import { loadPaperIndex, loadPapers } from './load';
import { paperLinks, paperTopics, selectPapers, titleNamesObject, topicsForPaper, type PaperOrder, type PaperTopic } from './selection';
import type { Paper, PaperIndex, PaperPage } from './types';
import './papers.css';

export function PapersView({object,catalogueSha256,localFile}:{object:MessierObject;catalogueSha256:string;localFile:(path:string)=>string}) {
  const [index,setIndex]=useState<PaperIndex|null>(null),[page,setPage]=useState<PaperPage|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(true),[reload,setReload]=useState(0);
  const [search,setSearch]=useState(''),[topic,setTopic]=useState<PaperTopic|'all'>('all'),[order,setOrder]=useState<PaperOrder>('object');
  const [since,setSince]=useState(''),[number,setNumber]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();setBusy(true);setError('');setPage(null);setIndex(null);
    void loadPaperIndex(localFile,catalogueSha256,controller.signal).then(async snapshot=>{
      if(controller.signal.aborted)return;
      setIndex(snapshot);const reference=snapshot?.objects.find(o=>o.objectId===object.id);
      if(reference?.status==='error')throw new Error(reference.error??'Bibliography query failed.');
      if(reference?.path){const result=await loadPapers(reference,localFile,controller.signal);if(!controller.signal.aborted)setPage(result);}
    }).catch(reason=>{if(!controller.signal.aborted)setError(reason instanceof Error?reason.message:'Papers unavailable.');})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[object.id,catalogueSha256,localFile,reload]);
  const reference=index?.objects.find(o=>o.objectId===object.id);
  const filtered=useMemo(()=>selectPapers(page?.papers??[],object,search,topic,order,/^\d{4}$/.test(since)?Number(since):null),[page,object,search,topic,order,since]);
  const pages=Math.max(1,Math.ceil(filtered.length/20)),actual=Math.min(number,pages-1);
  function reset(){setNumber(0);}
  return <section className="catalogue-papers" aria-label="Object papers" aria-busy={busy}>
    <div className="catalogue-paper-toolbar">
      <label className="catalogue-field">Find paper<input type="search" placeholder="Title, abstract, DOI…" value={search} onChange={e=>{setSearch(e.target.value);reset();}} /></label>
      <label className="catalogue-field">Topic<select value={topic} onChange={e=>{const v=e.target.value;if(v==='all'||paperTopics.some(t=>t===v)){setTopic(v as PaperTopic|'all');reset();}}}>
        <option value="all">All topics</option>{paperTopics.map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="catalogue-field">Order papers<select value={order} onChange={e=>{const v=e.target.value;if(v==='object'||v==='newest'||v==='oldest'){setOrder(v);reset();}}}>
        <option value="object">Object in title first</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>
      <label className="catalogue-field catalogue-paper-year">Since<input type="number" min="1500" max="2200" placeholder="Any year" value={since} onChange={e=>{setSince(e.target.value);reset();}} /></label>
      <button type="button" onClick={()=>setReload(v=>v+1)} disabled={busy}>Reload papers</button>
    </div>
    <p className="catalogue-paper-status" role={error?'alert':'status'}>{error || (busy?'Reading papers…':!index?'Paper index not prepared.':!page?'Bibliography acquisition pending.':
      `${filtered.length.toLocaleString()} shown · ${page.papers.length.toLocaleString()} indexed references${reference?.status==='partial'?' · Partial snapshot':''}`)}
      {index&&<> · {index.objects.filter(o=>o.status==='complete').length}/110 objects indexed</>}</p>
    <p className="catalogue-paper-note" title="SIMBAD associates these references with the selected object. Some only mention it or study a larger sample. Topic tags are keyword matches in titles/abstracts, not validated physical evidence. No PDFs are downloaded and browsing starts no processing.">
      <a href="https://simbad.cds.unistra.fr/Pages/guide/ch15.htx#Section4" target="_blank" rel="noreferrer">CDS SIMBAD bibliography ↗</a> · Topics from text · Review before modeling ⓘ
      {page&&<> · Snapshot {new Date(page.retrievedAt).toLocaleDateString()}</>}
    </p>
    {object.notes&&<p className="catalogue-paper-note" title={object.notes}>Object identity has qualifications; references follow its SIMBAD entry ⓘ</p>}
    <div className="catalogue-paper-results">
      {!busy&&!error&&page&&!filtered.length&&<p className="catalogue-empty">No papers match these filters.</p>}
      {filtered.slice(actual*20,(actual+1)*20).map(paper=><PaperRow key={paper.bibcode} paper={paper} object={object}/>)}
      {pages>1&&<div className="catalogue-pagination"><button type="button" disabled={!actual} onClick={()=>setNumber(actual-1)}>Previous papers</button><span>{actual+1} / {pages}</span><button type="button" disabled={actual===pages-1} onClick={()=>setNumber(actual+1)}>Next papers</button></div>}
    </div>
  </section>;
}
function PaperRow({paper,object}:{paper:Paper;object:MessierObject}){
  const [expanded,setExpanded]=useState(false),links=paperLinks(paper),topics=topicsForPaper(paper);
  return <article className="catalogue-paper" data-bibcode={paper.bibcode}>
    <h3><a href={links.ads} target="_blank" rel="noreferrer">{paper.title||paper.bibcode} ↗</a></h3>
    <div className="catalogue-paper-meta"><span>{paper.year??'Year unknown'} · {paper.journal??'Journal unreported'} · {paper.bibcode}</span>
      {titleNamesObject(paper,object)&&<span className="catalogue-paper-match">Object in title</span>}</div>
    <div className="catalogue-paper-tags" title="Automatic title/abstract keyword matches; inspect the paper for actual constraints.">{topics.map(t=><span key={t}>{t}</span>)}</div>
    <div className="catalogue-product-links">
      {paper.abstract?<button type="button" aria-expanded={expanded} onClick={()=>setExpanded(v=>!v)}>{expanded?'Close abstract':'Abstract'}</button>:<span>Abstract unavailable</span>}
      {links.doi&&<a href={links.doi} target="_blank" rel="noreferrer">Publisher ↗</a>}
      {links.arxiv&&<a href={links.arxiv} target="_blank" rel="noreferrer">arXiv ↗</a>}
      <a href={links.ads} target="_blank" rel="noreferrer">ADS / full-text links ↗</a>
      <a href={links.simbad} target="_blank" rel="noreferrer" title={paper.objectNames?`Indexed object names: ${paper.objectNames}`:'Source bibliography record'}>SIMBAD ↗</a>
    </div>
    {expanded&&<p className="catalogue-paper-abstract">{paper.abstract}</p>}
  </article>;
}
