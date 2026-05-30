/* global React, Icon, SAMPLE, window */
const { useState, useRef } = React;

function clone(o){ return JSON.parse(JSON.stringify(o)); }
const EMPTY_PERFIL = {
  header:{nome:'',email:'',telefone:'',localizacao:'',linkedin:'',github:'',website:'',resumo:''},
  experiencia:[], formacao:[], habilidades:[], projetos:[], idiomas:[], cursos:[],
};

const HEADER_FIELDS = [
  {key:'nome', label:'Nome completo', req:true, col:'span2', ph:'Ex.: Maria Silva'},
  {key:'email', label:'E-mail', ph:'voce@email.com'},
  {key:'telefone', label:'Telefone', ph:'+55 11 90000-0000'},
  {key:'localizacao', label:'Localização', ph:'Cidade, UF'},
  {key:'website', label:'Website', ph:'site.com'},
  {key:'linkedin', label:'LinkedIn', ph:'linkedin.com/in/voce'},
  {key:'github', label:'GitHub', ph:'github.com/voce'},
  {key:'resumo', label:'Resumo / objetivo', type:'textarea', col:'span2', ph:'Breve descrição profissional — a IA pode reescrever, nunca inventar.'},
];

const per = (it)=> it.inicio ? (it.inicio + (it.atual ? ' – Atual' : (it.fim ? ' – '+it.fim : ''))) : '';
const SECTIONS = [
  { key:'experiencia', title:'Experiência', icon:'briefcase', singular:'experiência',
    emptyHint:'Nenhuma experiência adicionada. Comece pela mais recente.',
    blank:{empresa:'',cargo:'',local:'',inicio:'',fim:'',atual:false,realizacoes:[]},
    fields:[
      {key:'cargo', label:'Cargo', req:true}, {key:'empresa', label:'Empresa', req:true},
      {key:'local', label:'Local', ph:'Cidade, UF ou Remoto'}, {key:'atual', label:'Emprego atual', type:'toggle'},
      {key:'inicio', label:'Início', req:true, ph:'2023'}, {key:'fim', label:'Fim', ph:'2024'},
      {key:'realizacoes', label:'Realizações', type:'bullets', col:'span2', ph:'Uma conquista por linha'},
    ],
    summary:(it)=>({title:it.cargo, meta:[it.empresa, per(it)].filter(Boolean).join(' · ')}) },

  { key:'formacao', title:'Formação', icon:'cap', singular:'formação',
    emptyHint:'Nenhuma formação adicionada.',
    blank:{instituicao:'',grau:'',area:'',inicio:'',fim:'',nota:'',detalhes:''},
    fields:[
      {key:'instituicao', label:'Instituição', req:true, col:'span2'},
      {key:'grau', label:'Grau', req:true, ph:'Bacharelado'}, {key:'area', label:'Área', ph:'Ciência da Computação'},
      {key:'inicio', label:'Início', req:true, ph:'2017'}, {key:'fim', label:'Fim', ph:'2021'},
      {key:'nota', label:'Nota / CR', ph:'8.7/10'},
      {key:'detalhes', label:'Detalhes', type:'textarea', col:'span2', ph:'TCC, atividades, honrarias…'},
    ],
    summary:(it)=>({title:[it.grau,it.area].filter(Boolean).join(', '), meta:[it.instituicao, per(it)].filter(Boolean).join(' · ')}) },

  { key:'habilidades', title:'Habilidades', icon:'chip', singular:'habilidade',
    emptyHint:'Nenhuma habilidade adicionada. Agrupe por categoria.',
    blank:{categoria:'',nome:'',nivel:''},
    fields:[
      {key:'categoria', label:'Categoria', req:true, ph:'Linguagens'}, {key:'nivel', label:'Nível', ph:'Avançado'},
      {key:'nome', label:'Habilidade', req:true, col:'span2', ph:'Go, TypeScript, SQL…'},
    ],
    summary:(it)=>({title:it.nome, meta:[it.categoria, it.nivel].filter(Boolean).join(' · ')}) },

  { key:'projetos', title:'Projetos', icon:'folder', singular:'projeto',
    emptyHint:'Nenhum projeto adicionado.',
    blank:{nome:'',descricao:'',destaques:[],stack:[],url:''},
    fields:[
      {key:'nome', label:'Nome', req:true}, {key:'url', label:'URL', ph:'github.com/voce/projeto'},
      {key:'descricao', label:'Descrição', req:true, type:'textarea', col:'span2'},
      {key:'destaques', label:'Destaques', type:'bullets', col:'span2', ph:'Um destaque por linha'},
      {key:'stack', label:'Stack', type:'tags', col:'span2'},
    ],
    summary:(it)=>({title:it.nome, meta:(it.stack||[]).join(', ')}) },

  { key:'idiomas', title:'Idiomas', icon:'globe', singular:'idioma',
    emptyHint:'Nenhum idioma adicionado.',
    blank:{idioma:'',proficiencia:''},
    fields:[
      {key:'idioma', label:'Idioma', req:true, ph:'Inglês'}, {key:'proficiencia', label:'Proficiência', req:true, ph:'Avançado (C1)'},
    ],
    summary:(it)=>({title:it.idioma, meta:it.proficiencia}) },

  { key:'cursos', title:'Cursos / Certificações', icon:'award', singular:'certificação',
    emptyHint:'Nenhum curso ou certificação adicionado.',
    blank:{titulo:'',emissor:'',data:'',url:''},
    fields:[
      {key:'titulo', label:'Título', req:true, col:'span2'},
      {key:'emissor', label:'Emissor', req:true, ph:'Amazon Web Services'}, {key:'data', label:'Data', req:true, ph:'2024'},
      {key:'url', label:'URL', col:'span2', ph:'credencial.com/...'},
    ],
    summary:(it)=>({title:it.titulo, meta:[it.emissor, it.data].filter(Boolean).join(' · ')}) },
];

function Bullets({items, onChange, ph}){
  items = items || [];
  return (
    <div className="bullets">
      {items.map((b,i)=>(
        <div className="bullet-row" key={i}>
          <span className="bdot">•</span>
          <input className="input" value={b} placeholder={ph}
            onChange={e=>{const n=items.slice(); n[i]=e.target.value; onChange(n);}} />
          <button className="ctrl danger" aria-label="Remover item" onClick={()=>onChange(items.filter((_,j)=>j!==i))}><Icon name="trash"/></button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm bullet-add" onClick={()=>onChange(items.concat(['']))}><Icon name="plus"/> Adicionar item</button>
    </div>
  );
}
function Tags({items, onChange}){
  const [draft, setDraft] = useState('');
  items = items || [];
  const add = ()=>{ const v=draft.trim(); if(v){ onChange(items.concat([v])); setDraft(''); } };
  return (
    <div className="tags">
      {items.map((t,i)=>(<span className="tag" key={i}>{t}<button aria-label={'Remover '+t} onClick={()=>onChange(items.filter((_,j)=>j!==i))}><Icon name="close"/></button></span>))}
      <input className="tag-input" value={draft} placeholder="Adicionar…" aria-label="Adicionar tecnologia"
        onChange={e=>setDraft(e.target.value)} onBlur={add}
        onKeyDown={e=>{ if(e.key==='Enter'){ e.preventDefault(); add(); } }} />
    </div>
  );
}
function Field({path, f, value, error, disabled, onChange}){
  const id = 'f-'+path.replace(/\./g,'-');
  const cls = 'field'+(f.col==='span2'?' span2':'');
  if(f.type==='toggle'){
    return (
      <div className={cls}>
        <div className="switch-field">
          <button id={id} role="switch" aria-checked={!!value} className="switch" onClick={()=>onChange(!value)}></button>
          <label htmlFor={id} onClick={()=>onChange(!value)}>{f.label}</label>
        </div>
      </div>
    );
  }
  return (
    <div className={cls}>
      <label className="label" htmlFor={id}>{f.label}{f.req && <span className="req">*</span>}</label>
      {f.type==='textarea'
        ? <textarea id={id} className={'input'+(error?' err':'')} value={value||''} placeholder={f.ph} onChange={e=>onChange(e.target.value)} />
        : f.type==='bullets' ? <Bullets items={value} onChange={onChange} ph={f.ph} />
        : f.type==='tags' ? <Tags items={value} onChange={onChange} />
        : <input id={id} className={'input'+(error?' err':'')} value={disabled?'':(value||'')} placeholder={disabled?'Atual':f.ph} disabled={disabled} onChange={e=>onChange(e.target.value)} />}
      {error && <span className="help err">{error}</span>}
    </div>
  );
}

function Skeleton(){
  return (
    <div aria-busy="true">
      <div className="skel" style={{height:30,width:160,borderRadius:8,marginBottom:8}}></div>
      <div className="skel" style={{height:18,width:380,borderRadius:6,marginBottom:28}}></div>
      <div className="skel" style={{height:200,width:'100%',borderRadius:12,marginBottom:28}}></div>
      <div className="skel" style={{height:120,width:'100%',borderRadius:12,marginBottom:14}}></div>
      <div className="skel" style={{height:120,width:'100%',borderRadius:12}}></div>
    </div>
  );
}

function PerfilScreen(){
  const [demo, setDemo] = useState('pronto');
  const [data, setData] = useState(()=>clone(SAMPLE));
  const [errors, setErrors] = useState({});
  const [save, setSave] = useState('idle'); // idle | saving | saved | error
  const t = useRef(null);

  function applyDemo(d){
    clearTimeout(t.current);
    if(d==='vazio'){ setData(clone(EMPTY_PERFIL)); setErrors({}); setSave('idle'); }
    else if(d==='salvando'){ setSave('saving'); }
    else if(d==='salvo'){ setSave('saved'); }
    else if(d==='erro'){
      const nd = clone(SAMPLE); nd.header.nome=''; nd.experiencia[1].empresa=''; setData(nd);
      setErrors({'header.nome':'Informe o nome completo.','experiencia.1.empresa':'Informe o nome da empresa.'});
      setSave('error');
    } else if(d==='pronto'){ setData(clone(SAMPLE)); setErrors({}); setSave('idle'); }
    setDemo(d);
  }

  const setHeader = (k,v)=> setData(p=>({...p, header:{...p.header,[k]:v}}));
  const setItem = (sec,idx,k,v)=> setData(p=>{ const arr=p[sec].slice(); arr[idx]={...arr[idx],[k]:v}; return {...p,[sec]:arr}; });
  const addItem = (sec,blank)=> setData(p=>({...p,[sec]:p[sec].concat([clone(blank)])}));
  const removeItem = (sec,idx)=> setData(p=>({...p,[sec]:p[sec].filter((_,j)=>j!==idx)}));
  const moveItem = (sec,idx,dir)=> setData(p=>{ const arr=p[sec].slice(); const j=idx+dir; if(j<0||j>=arr.length) return p; const tmp=arr[idx]; arr[idx]=arr[j]; arr[j]=tmp; return {...p,[sec]:arr}; });

  function handleSave(){
    const e={};
    if(!data.header.nome.trim()) e['header.nome']='Informe o nome completo.';
    const temBase = data.experiencia.length>0 || data.formacao.length>0;
    setErrors(e);
    if(Object.keys(e).length || !temBase){ setSave('error'); setDemo('erro'); return; }
    setSave('saving'); setDemo('salvando');
    clearTimeout(t.current);
    t.current = setTimeout(()=>{ setSave('saved'); setDemo('salvo');
      t.current=setTimeout(()=>{ setSave('idle'); setDemo('pronto'); }, 2600); }, 1200);
  }

  const isEmpty = demo==='vazio';
  const demoChips = [['carregando','Carregando'],['pronto','Pronto'],['vazio','Vazio'],['salvando','Salvando'],['salvo','Salvo'],['erro','Erro de validação']];

  return (
    <React.Fragment>
      <div className="demobar" role="group" aria-label="Estados (demonstração)">
        <span className="dlabel"><Icon name="spark"/> Estados</span>
        {demoChips.map(([k,l])=> <button key={k} className="dchip" aria-pressed={demo===k} onClick={()=>applyDemo(k)}>{l}</button>)}
      </div>

      <div className="page-head">
        <h1>Perfil</h1>
        <p className="sub">Esta é a sua base — a fonte da verdade que alimenta a geração. Tudo que aparece nos currículos sai daqui.</p>
      </div>

      {demo==='carregando' ? <Skeleton/> : (
      <React.Fragment>
        {isEmpty && (
          <div className="note note-accent" style={{marginBottom:26}}>
            <Icon name="info"/>
            <div className="note-body">
              <p className="note-title">Sua base ainda está vazia</p>
              <p>Preencha o nome e ao menos uma experiência ou formação, depois salve.</p>
            </div>
          </div>
        )}

        {/* Cabeçalho e resumo */}
        <section className="sec" style={{marginTop:0}}>
          <div className="sec-head2"><h2><span className="sec-ic"><Icon name="user"/></span>Cabeçalho e resumo</h2></div>
          <div className="card" style={{padding:20}}>
            <div className="field-grid">
              {HEADER_FIELDS.map(f=>(
                <Field key={f.key} path={'header.'+f.key} f={f} value={data.header[f.key]}
                  error={errors['header.'+f.key]} onChange={v=>setHeader(f.key,v)} />
              ))}
            </div>
          </div>
        </section>

        {/* 6 listas */}
        {SECTIONS.map(cfg=>{
          const items = data[cfg.key];
          return (
            <section className="sec" key={cfg.key}>
              <div className="sec-head2">
                <h2><span className="sec-ic"><Icon name={cfg.icon}/></span>{cfg.title}
                  {items.length>0 && <span className="count">· {items.length}</span>}</h2>
                <button className="btn btn-secondary btn-sm" onClick={()=>addItem(cfg.key,cfg.blank)}><Icon name="plus"/> Adicionar</button>
              </div>
              {items.length===0 ? (
                <div className="add-card">
                  {cfg.emptyHint}
                  <div><button className="btn btn-secondary btn-sm" onClick={()=>addItem(cfg.key,cfg.blank)}><Icon name="plus"/> Adicionar {cfg.singular}</button></div>
                </div>
              ) : items.map((it,idx)=>{
                const sum = cfg.summary(it);
                return (
                  <div className="item-card" key={idx}>
                    <div className="item-head">
                      <div className="ih-main">
                        <div className={'ih-title'+(sum.title?'':' empty')}>{sum.title || ('Nova '+cfg.singular)}</div>
                        {sum.meta && <div className="ih-meta">{sum.meta}</div>}
                      </div>
                      <div className="item-ctrls">
                        <button className="ctrl" disabled={idx===0} aria-label="Mover para cima" onClick={()=>moveItem(cfg.key,idx,-1)}><Icon name="up"/></button>
                        <button className="ctrl" disabled={idx===items.length-1} aria-label="Mover para baixo" onClick={()=>moveItem(cfg.key,idx,1)}><Icon name="down"/></button>
                        <button className="ctrl danger" aria-label={'Remover '+cfg.singular} onClick={()=>removeItem(cfg.key,idx)}><Icon name="trash"/></button>
                      </div>
                    </div>
                    <div className="item-body">
                      <div className="field-grid">
                        {cfg.fields.map(f=>{
                          const disabled = cfg.key==='experiencia' && f.key==='fim' && it.atual;
                          return <Field key={f.key} path={cfg.key+'.'+idx+'.'+f.key} f={f}
                            value={it[f.key]} error={errors[cfg.key+'.'+idx+'.'+f.key]} disabled={disabled}
                            onChange={v=>setItem(cfg.key,idx,f.key,v)} />;
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}

        {/* save bar */}
        <div className="savebar">
          <div className="left">
            {save==='error' ? <span style={{color:'var(--danger)'}}>Corrija os campos destacados antes de salvar.</span>
              : 'Alterações são salvas na sua base local (fonte da verdade).'}
          </div>
          {save==='saving' && <span className="sb-status"><span className="spin"></span> Salvando…</span>}
          {save==='saved' && <span className="badge badge-success"><Icon name="check" size={13}/> Salvo com sucesso</span>}
          {save==='error' && <span className="badge badge-danger"><Icon name="alert" size={13}/> Erro de validação</span>}
          <button className="btn btn-primary" onClick={handleSave} disabled={save==='saving'}>
            {save==='saving' ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </React.Fragment>
      )}
    </React.Fragment>
  );
}
window.PerfilScreen = PerfilScreen;
