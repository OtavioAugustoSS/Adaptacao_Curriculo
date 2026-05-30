/* global React, Icon, SAMPLE, SAMPLE_HISTORY, buildTex, window */
const { useState } = React;

function downloadTexFile(item){
  const tex = buildTex(SAMPLE, item.mode, item.titulo);
  const blob = new Blob([tex], {type:'text/x-tex'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (item.id||'curriculo')+'.tex';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
}

function AvisoList({avisos}){
  return (
    <ul className="aviso-list">
      {avisos.map((a,i)=>(
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
  );
}

function HistoryCard({item}){
  const [open, setOpen] = useState(false);
  const n = item.avisos.length;
  const adaptado = item.mode==='adaptado';
  return (
    <article className="cv-item">
      <div className="cv-top">
        <div className={'cv-emblem '+item.mode}>
          <Icon name="file"/>
          <span className="ext">.tex</span>
        </div>
        <div className="cv-info">
          <div className="cv-title-row">
            <span className="cv-title">{item.titulo}</span>
            {adaptado
              ? <span className="badge badge-accent"><span className="dot"></span>Adaptado</span>
              : <span className="badge badge-neutral"><span className="dot"></span>Padrão</span>}
          </div>
          <div className="cv-date">
            <Icon name="clock"/> {item.data}
            <span className="cv-sep">·</span>
            <span className="cv-file">{item.id}.tex</span>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm cv-dl" onClick={()=>downloadTexFile(item)}>
          <Icon name="download"/> Baixar .tex
        </button>
      </div>
      <div className="cv-meta">
        <span className="cv-src"><Icon name="cap"/> template faangpath · pronto para o Overleaf</span>
        {n===0
          ? <span className="cv-clean"><Icon name="check"/> Sem avisos de rastreabilidade</span>
          : <button className="cv-warnbtn" aria-expanded={open} onClick={()=>setOpen(o=>!o)}>
              <Icon name="alert"/> {n} {n===1?'aviso':'avisos'} de rastreabilidade
              <Icon name="down" size={13}/>
            </button>}
      </div>
      {open && n>0 && (
        <div className="cv-avisos">
          <div className="note note-warning">
            <Icon name="alert"/>
            <div className="note-body">
              <p className="note-title">Itens a revisar</p>
              <p>A IA reescreveu ou condensou estes trechos. Nada foi inventado — confira antes de enviar.</p>
              <AvisoList avisos={item.avisos} />
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function CurriculosScreen({go}){
  const [demo, setDemo] = useState('populado');
  const demoChips = [['carregando','Carregando'],['populado','Populado'],['vazio','Vazio'],['erro','Erro']];

  return (
    <React.Fragment>
      <div className="demobar" role="group" aria-label="Estados (demonstração)">
        <span className="dlabel"><Icon name="spark"/> Estados</span>
        {demoChips.map(([k,l])=> <button key={k} className="dchip" aria-pressed={demo===k} onClick={()=>setDemo(k)}>{l}</button>)}
      </div>

      <div className="page-head">
        <h1>Meus currículos</h1>
        <p className="sub">Histórico dos currículos gerados. Baixe o <span className="mono">.tex</span> cacheado sem gastar nova geração e revise os avisos.</p>
      </div>

      {demo==='carregando' && (
        <div className="cv-list" aria-busy="true">
          {[0,1,2].map(i=>(
            <div className="cv-item" key={i} style={{padding:'16px 18px'}}>
              <div className="skel" style={{height:18,width:'45%',borderRadius:6,marginBottom:10}}></div>
              <div className="skel" style={{height:13,width:'30%',borderRadius:6}}></div>
            </div>
          ))}
        </div>
      )}

      {demo==='erro' && (
        <div className="note note-danger">
          <Icon name="alert"/>
          <div className="note-body">
            <p className="note-title">Não foi possível carregar o histórico</p>
            <p>Houve uma falha ao buscar seus currículos. Tente novamente em instantes.</p>
            <div style={{marginTop:12}}>
              <button className="btn btn-secondary btn-sm" onClick={()=>setDemo('populado')}><Icon name="retry"/> Tentar novamente</button>
            </div>
          </div>
        </div>
      )}

      {demo==='vazio' && (
        <div className="empty-state">
          <div className="ic"><Icon name="files"/></div>
          <h3>Nenhum currículo ainda</h3>
          <p>Você ainda não gerou nenhum currículo. Gere o primeiro a partir da sua base.</p>
          <button className="btn btn-primary" onClick={()=>go && go('gerar')}><Icon name="spark"/> Gerar meu primeiro currículo</button>
        </div>
      )}

      {demo==='populado' && (
        <div className="cv-list">
          {SAMPLE_HISTORY.map(item=> <HistoryCard key={item.id} item={item} />)}
        </div>
      )}
    </React.Fragment>
  );
}
window.CurriculosScreen = CurriculosScreen;
