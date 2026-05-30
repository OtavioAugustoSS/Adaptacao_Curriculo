/* global React, ReactDOM, Icon, GerarScreen, SAMPLE, window, document, localStorage */
const { useState, useEffect } = React;

function useTheme(){
  const [theme, setTheme] = useState(()=>{
    try{ return localStorage.getItem('cv-theme') || 'dark'; }catch(e){ return 'dark'; }
  });
  useEffect(()=>{
    document.documentElement.setAttribute('data-theme', theme);
    try{ localStorage.setItem('cv-theme', theme); }catch(e){}
  },[theme]);
  return [theme, setTheme];
}

function ThemeToggle({theme, setTheme}){
  return (
    <div className="theme-seg" role="group" aria-label="Tema">
      <button aria-pressed={theme==='light'} onClick={()=>setTheme('light')}><Icon name="sun"/> Light</button>
      <button aria-pressed={theme==='dark'} onClick={()=>setTheme('dark')}><Icon name="moon"/> Dark</button>
    </div>
  );
}

const NAV = [
  ['home','Início','home'],
  ['perfil','Perfil','user'],
  ['gerar','Gerar','spark'],
  ['curriculos','Currículos','files'],
];

function Sidebar({route, go, theme, setTheme, onNav, counts}){
  return (
    <aside className="sidebar">
      <button className="sb-brand" onClick={()=>{go('home'); onNav&&onNav();}}
        style={{border:0,background:'transparent',cursor:'pointer',width:'100%',font:'inherit',color:'inherit'}}>
        <span className="logo">cv</span>
        <span>CV-Adapter</span>
      </button>
      <nav className="sb-nav">
        <div className="navhead">Navegação</div>
        {NAV.map(([key,label,icon])=>(
          <button key={key} className={'navitem'+(route===key?' active':'')}
            aria-current={route===key?'page':undefined}
            onClick={()=>{go(key); onNav&&onNav();}}>
            <Icon name={icon}/> {label}
            {counts[key]!=null && <span className="nav-sub">{counts[key]}</span>}
          </button>
        ))}
      </nav>
      <div className="sb-foot">
        <ThemeToggle theme={theme} setTheme={setTheme} />
      </div>
    </aside>
  );
}

function SoonScreen({title, sub, icon, cta, go}){
  return (
    <React.Fragment>
      <div className="page-head">
        <h1>{title}</h1>
        <p className="sub">{sub}</p>
      </div>
      <div className="soon">
        <div className="ic"><Icon name={icon}/></div>
        <h3>Próxima etapa do projeto</h3>
        <p>Esta tela entra logo após a aprovação da <b style={{color:'var(--fg)'}}>Casca</b> e da tela <b style={{color:'var(--fg)'}}>Gerar</b>. Por ora, explore o shell e o fluxo de geração.</p>
        {cta && <button className="btn btn-primary" style={{marginTop:18}} onClick={()=>go('gerar')}><Icon name="arrow"/> Ir para Gerar</button>}
      </div>
    </React.Fragment>
  );
}

function App(){
  const [theme, setTheme] = useTheme();
  const [route, setRoute] = useState('home');
  const [menu, setMenu] = useState(false);
  const go = (r)=>{ setRoute(r); window.scrollTo(0,0); };
  const labelFor = {perfil:'Perfil', gerar:'Gerar', curriculos:'Currículos', home:'Início'};
  const baseCount = SAMPLE.experiencia.length+SAMPLE.formacao.length+SAMPLE.habilidades.length
    +SAMPLE.projetos.length+SAMPLE.idiomas.length+SAMPLE.cursos.length;
  const counts = {perfil: baseCount+' itens', curriculos: String(window.SAMPLE_HISTORY?window.SAMPLE_HISTORY.length:0)};

  return (
    <div className={'app'+(menu?' menu-open':'')}>
      <div className="scrim" onClick={()=>setMenu(false)}></div>
      <Sidebar route={route} go={go} theme={theme} setTheme={setTheme} onNav={()=>setMenu(false)} counts={counts} />
      <div className="main">
        <div className="topbar-m">
          <button className="icon-btn" aria-label="Abrir menu" onClick={()=>setMenu(true)}><Icon name="menu"/></button>
          <span className="logo">cv</span>
          <span style={{fontWeight:600,letterSpacing:'-.01em'}}>CV-Adapter</span>
          <span style={{flex:1}}></span>
          <span style={{color:'var(--fg-muted)',fontFamily:'var(--font-mono)',fontSize:12}}>{labelFor[route]}</span>
        </div>
        <main className="content">
          {route==='home' && <HomeScreen go={go}/>}
          {route==='gerar' && <GerarScreen/>}
          {route==='perfil' && <PerfilScreen/>}
          {route==='curriculos' && <CurriculosScreen go={go}/>}
        </main>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
