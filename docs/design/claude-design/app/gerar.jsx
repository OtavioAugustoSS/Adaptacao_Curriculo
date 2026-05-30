/* global React, Icon, SAMPLE, buildTex, SAMPLE_AVISOS, window */
const { useState, useRef, useEffect } = React;

function CodeTex({ tex }){
  // light syntax highlight for \commands, %comments, {args}
  const html = tex.split('\n').map(line=>{
    let l = line.replace(/[&<>]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
    if(/^\s*%/.test(l)) return '<span class="c">'+l+'</span>';
    l = l.replace(/(\\[a-zA-Z]+)/g,'<span class="k">$1</span>');
    return l;
  }).join('\n');
  return <div className="code" style={{maxHeight:520}}><pre dangerouslySetInnerHTML={{__html: html}} /></div>;
}

function GerarScreen(){
  const [mode, setMode] = useState('padrao');           // padrao | adaptado
  const [job, setJob] = useState('');
  const [state, setState] = useState('idle');            // base | loading | idle | generating | error | done
  const [avisos, setAvisos] = useState(true);            // preview shows traceability warnings
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const copyTimer = useRef(null);

  useEffect(()=>()=>clearTimeout(timer.current),[]);

  const jobTitle = (job.trim().split('\n')[0]||'').slice(0,42);
  const tex = buildTex(SAMPLE, state==='done'&&avisos?'adaptado':'padrao', jobTitle);

  function generate(){
    setState('generating');
    clearTimeout(timer.current);
    timer.current = setTimeout(()=>{
      const withAvisos = mode==='adaptado';
      setAvisos(withAvisos);
      setState('done');
    }, 1800);
  }
  function setDemo(s){
    clearTimeout(timer.current);
    if(s==='preview-avisos'){ setAvisos(true); setState('done'); }
    else if(s==='preview-limpo'){ setAvisos(false); setState('done'); }
    else setState(s);
  }

  function copyTex(){
    if(navigator.clipboard) navigator.clipboard.writeText(tex);
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(()=>setCopied(false), 2000);
  }
  function downloadTex(){
    const blob = new Blob([tex], {type:'text/x-tex'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'curriculo.tex';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  const primaryLabel = mode==='adaptado' ? 'Adaptar à vaga' : 'Gerar currículo padrão';
  const canGenerate = mode==='padrao' || job.trim().length>0;

  const demoChips = [
    ['base','Base insuficiente'],['loading','Validando'],['idle','Ocioso'],
    ['generating','Gerando'],['error','Erro'],['preview-avisos','Preview · avisos'],['preview-limpo','Preview · limpo'],
  ];
  const activeDemo = state==='done' ? (avisos?'preview-avisos':'preview-limpo') : state;

  return (
    <React.Fragment>
      {/* DEMO STATE BAR */}
      <div className="demobar" role="group" aria-label="Estados (demonstração)">
        <span className="dlabel"><Icon name="spark"/> Estados</span>
        {demoChips.map(([k,label])=>
          <button key={k} className="dchip" aria-pressed={activeDemo===k} onClick={()=>setDemo(k)}>{label}</button>
        )}
      </div>

      <div className="page-head">
        <h1>Gerar currículo</h1>
        <p className="sub">A IA monta um currículo usando apenas itens reais da sua base — nunca inventa. A saída é um arquivo <span className="mono">.tex</span> para compilar no Overleaf.</p>
      </div>

      {/* base insuficiente */}
      {state==='base' && (
        <div className="note note-warning" style={{marginBottom:24}}>
          <Icon name="alert"/>
          <div className="note-body">
            <p className="note-title">Base insuficiente</p>
            <p>Sua base ainda não atende ao mínimo: preencha o nome e ao menos uma experiência ou formação em <a href="#" onClick={e=>e.preventDefault()}>Perfil</a>.</p>
          </div>
        </div>
      )}

      {/* mode tabs */}
      <div className="tabs" role="tablist" aria-label="Modo de geração">
        <button className="tab" role="tab" aria-selected={mode==='padrao'} onClick={()=>setMode('padrao')}>
          <Icon name="file"/> Currículo padrão
        </button>
        <button className="tab" role="tab" aria-selected={mode==='adaptado'} onClick={()=>setMode('adaptado')}>
          <Icon name="spark"/> Adaptar à vaga
        </button>
      </div>
      <p className="gen-mode-hint">
        {mode==='padrao'
          ? 'Gera um currículo completo a partir de toda a sua base, sem foco em uma vaga específica.'
          : 'Reordena e prioriza os itens da sua base de acordo com a vaga — sem inventar nada.'}
      </p>

      {/* adaptado: textarea */}
      {mode==='adaptado' && (
        <div className="gen-block">
          <div className="field">
            <label className="label" htmlFor="vaga">Texto da vaga</label>
            <textarea id="vaga" className="input" style={{minHeight:280}}
              placeholder="Cole aqui a descrição completa da vaga…"
              value={job} onChange={e=>setJob(e.target.value)}
              disabled={state==='generating'} />
            <span className="help">Cole a descrição da vaga para habilitar a adaptação.</span>
          </div>
        </div>
      )}

      {/* actions */}
      <div className="gen-actions">
        {state==='generating' ? (
          <React.Fragment>
            <button className="btn btn-primary btn-lg" disabled>
              <span className="spin"></span> Gerando…
            </button>
            <span className="muted">Chamando a IA — pode levar alguns segundos.</span>
          </React.Fragment>
        ) : (
          <button className="btn btn-primary btn-lg"
            disabled={state==='base' || state==='loading' || !canGenerate}
            onClick={generate}>
            <Icon name="spark"/> {primaryLabel}
          </button>
        )}
        {mode==='adaptado' && !canGenerate && state!=='generating' && state!=='base' &&
          <span className="muted">Cole a vaga para habilitar.</span>}
      </div>

      {/* erro */}
      {state==='error' && (
        <div className="note note-danger" style={{marginTop:24}}>
          <Icon name="alert"/>
          <div className="note-body">
            <p className="note-title">Não foi possível gerar o currículo</p>
            <p>A chamada à IA falhou. Sua base está intacta — tente novamente em alguns instantes.</p>
            <div style={{marginTop:12}}>
              <button className="btn btn-secondary btn-sm" onClick={generate}>
                <Icon name="retry"/> Tentar novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* validando skeleton */}
      {state==='loading' && (
        <div className="preview" aria-busy="true" aria-label="Validando">
          <div className="preview-head">
            <div className="skel" style={{height:24,width:280,borderRadius:8}}></div>
            <div style={{display:'flex',gap:10}}>
              <div className="skel" style={{height:36,width:104,borderRadius:8}}></div>
              <div className="skel" style={{height:36,width:124,borderRadius:8}}></div>
            </div>
          </div>
          <div className="skel" style={{height:56,width:'100%',borderRadius:10,marginBottom:14}}></div>
          <div className="skel" style={{height:300,width:'100%',borderRadius:10}}></div>
        </div>
      )}

      {/* preview */}
      {state==='done' && (
        <div className="preview">
          <div className="preview-head">
            <h2><Icon name="file"/> {avisos ? 'Currículo adaptado à vaga (.tex)' : 'Currículo gerado (.tex)'}</h2>
            <div className="preview-actions">
              <button className="btn btn-secondary" onClick={copyTex}>
                {copied ? <React.Fragment><Icon name="check"/> Copiado!</React.Fragment> : <React.Fragment><Icon name="copy"/> Copiar</React.Fragment>}
              </button>
              <button className="btn btn-primary" onClick={downloadTex}><Icon name="download"/> Baixar .tex</button>
            </div>
          </div>

          {avisos && (
            <div className="avisos">
              <div className="note note-warning">
                <Icon name="alert"/>
                <div className="note-body">
                  <p className="note-title">{SAMPLE_AVISOS.length} itens a revisar</p>
                  <p>A IA reescreveu e condensou alguns trechos. Nada foi inventado — confira se cada ajuste reflete a realidade antes de enviar.</p>
                  <ul className="aviso-list">
                    {SAMPLE_AVISOS.map((a,i)=>(
                      <li className="aviso" key={i}>
                        <span className="av-num">{String(i+1).padStart(2,'0')}</span>
                        <div>
                          <span className="av-val">{a.valor}</span>
                          <p className="av-reason">{a.razao}</p>
                          <div className="av-field">{a.campo}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <CodeTex tex={tex} />
        </div>
      )}
    </React.Fragment>
  );
}
window.GerarScreen = GerarScreen;
