/* global React, Icon, SAMPLE, window */
const { useState } = React;

function plural(n, one, many){ return n+' '+(n===1?one:many); }

function HomeScreen({go}){
  const [demo, setDemo] = useState('populado');
  const vazia = demo==='vazio';
  const nome = (SAMPLE.header.nome||'').split(' ')[0] || 'você';

  const stats = [
    {icon:'briefcase', n:SAMPLE.experiencia.length, one:'experiência', many:'experiências'},
    {icon:'folder', n:SAMPLE.projetos.length, one:'projeto', many:'projetos'},
    {icon:'chip', n:SAMPLE.habilidades.length, one:'habilidade', many:'habilidades'},
  ];

  const cards = [
    {key:'perfil', icon:'user', title:'Perfil', desc:'Mantenha sua base — a fonte da verdade que alimenta tudo.'},
    {key:'gerar', icon:'spark', title:'Gerar', desc:'Monte um .tex padrão ou adaptado a uma vaga específica.'},
    {key:'curriculos', icon:'files', title:'Currículos', desc:'Reveja o histórico e baixe o .tex cacheado.'},
  ];

  return (
    <React.Fragment>
      <div className="demobar" role="group" aria-label="Estados (demonstração)">
        <span className="dlabel"><Icon name="spark"/> Estados</span>
        <button className="dchip" aria-pressed={demo==='populado'} onClick={()=>setDemo('populado')}>Base preenchida</button>
        <button className="dchip" aria-pressed={demo==='vazio'} onClick={()=>setDemo('vazio')}>Base vazia</button>
      </div>

      <div className="greet">
        <p className="hello">Bom te ver de volta</p>
        <h1>Olá, {nome}.</h1>
      </div>

      {vazia ? (
        <div className="note note-accent" style={{marginTop:20,marginBottom:34}}>
          <Icon name="info"/>
          <div className="note-body">
            <p className="note-title">Sua base ainda está vazia</p>
            <p>Comece preenchendo seu <a href="#" onClick={e=>{e.preventDefault(); go&&go('perfil');}}>Perfil</a> — sem base, a IA não tem o que selecionar.</p>
          </div>
        </div>
      ) : (
        <div className="stat-chips">
          {stats.map((s,i)=>(
            <span className="stat-chip" key={i}>
              <Icon name={s.icon}/> <b>{s.n}</b>&nbsp;<span className="scn">{s.n===1?s.one:s.many}</span>
            </span>
          ))}
        </div>
      )}

      <p className="eyebrow">Atalhos</p>
      <div className="shortcut-grid">
        {cards.map(c=>(
          <button className="shortcut" key={c.key} onClick={()=>go && go(c.key)}>
            <span className="sc-ic"><Icon name={c.icon}/></span>
            <h3>{c.title}<span className="arr"><Icon name="arrow"/></span></h3>
            <p>{c.desc}</p>
          </button>
        ))}
      </div>
    </React.Fragment>
  );
}
window.HomeScreen = HomeScreen;
