/* global window */
// CV-Adapter — sample base data (fixed data model; presentation only)
const SAMPLE = {
  header: {
    nome: 'Otávio Augusto Silva Santos',
    email: 'otavio.santos@email.com',
    telefone: '+55 11 98888-1234',
    localizacao: 'São Paulo, SP',
    linkedin: 'linkedin.com/in/otavio-santos',
    github: 'github.com/OtavioAugustoSS',
    website: 'otaviosantos.dev',
    resumo: 'Engenheiro de software backend com foco em sistemas distribuídos, APIs de alta disponibilidade e qualidade de código. Experiência guiando entregas de ponta a ponta.',
  },
  experiencia: [
    { empresa:'Nubank', cargo:'Engenheiro de Software Pleno', local:'Remoto', inicio:'2023', fim:'', atual:true,
      realizacoes:['Liderei a migração de um serviço monolítico para microsserviços em Clojure, reduzindo latência p99.','Implementei pipeline de observabilidade com métricas e tracing distribuído.','Mentorei pessoas desenvolvedoras juniores em revisões de código.'] },
    { empresa:'Stone', cargo:'Engenheiro de Software Júnior', local:'São Paulo, SP', inicio:'2021', fim:'2023', atual:false,
      realizacoes:['Desenvolvi APIs REST em Node.js para o produto de adquirência.','Aumentei a cobertura de testes do time de 40% para 85%.'] },
  ],
  formacao: [
    { instituicao:'Universidade de São Paulo (USP)', grau:'Bacharelado', area:'Ciência da Computação', inicio:'2017', fim:'2021', nota:'8.7/10', detalhes:'Trabalho de conclusão sobre escalonamento em sistemas distribuídos.' },
  ],
  habilidades: [
    { categoria:'Linguagens', nome:'Go, Clojure, TypeScript, Python', nivel:'Avançado' },
    { categoria:'Infraestrutura', nome:'Kubernetes, AWS, Terraform', nivel:'Intermediário' },
    { categoria:'Dados', nome:'PostgreSQL, Kafka, Redis', nivel:'Avançado' },
  ],
  projetos: [
    { nome:'CV-Adapter', descricao:'Aplicação web que adapta currículos com IA para o template LaTeX faangpath.', destaques:['Geração determinística de .tex','Modo padrão e adaptado à vaga'], stack:['Next.js','TypeScript','LaTeX'], url:'github.com/OtavioAugustoSS/Adaptacao_Curriculo' },
  ],
  idiomas: [
    { idioma:'Português', proficiencia:'Nativo' },
    { idioma:'Inglês', proficiencia:'Avançado (C1)' },
  ],
  cursos: [
    { titulo:'AWS Certified Solutions Architect – Associate', emissor:'Amazon Web Services', data:'2024', url:'' },
  ],
};

function texEscape(s){return (s||'').replace(/([&%$#_])/g,'\\$1');}

// Build a faangpath-style .tex from the base data.
function buildTex(data, mode, jobTitle){
  const h = data.header;
  const L = [];
  L.push('% Gerado por CV-Adapter — template faangpath (compile no Overleaf)');
  if(mode==='adaptado') L.push('% Modo: adaptado à vaga' + (jobTitle?(' — '+jobTitle):''));
  else L.push('% Modo: currículo padrão');
  L.push('\\documentclass[]{resume}');
  L.push('\\usepackage[left=0.4in,top=0.4in,right=0.4in,bottom=0.4in]{geometry}');
  L.push('\\name{'+texEscape(h.nome)+'}');
  const addr = [h.localizacao, h.telefone].filter(Boolean).map(texEscape).join(' \\\\ ');
  const addr2 = [h.email, h.linkedin].filter(Boolean).map(texEscape).join(' \\\\ ');
  if(addr) L.push('\\address{'+addr+'}');
  if(addr2) L.push('\\address{'+addr2+'}');
  L.push('');
  L.push('\\begin{document}');
  L.push('');
  if(h.resumo){
    L.push('\\begin{rSection}{OBJETIVO}');
    L.push('  '+texEscape(h.resumo));
    L.push('\\end{rSection}');
    L.push('');
  }
  if(data.experiencia.length){
    L.push('\\begin{rSection}{EXPERIÊNCIA}');
    data.experiencia.forEach(e=>{
      const periodo = e.inicio + (e.atual?' -- Atual':(e.fim?(' -- '+e.fim):''));
      L.push('  \\textbf{'+texEscape(e.cargo)+'} \\hfill '+periodo+'\\\\');
      L.push('  '+texEscape(e.empresa)+(e.local?(' \\hfill '+texEscape(e.local)):'')+'');
      if(e.realizacoes && e.realizacoes.length){
        L.push('  \\begin{itemize}\\itemsep -3pt {}');
        e.realizacoes.forEach(r=> L.push('    \\item '+texEscape(r)));
        L.push('  \\end{itemize}');
      }
      L.push('');
    });
    L.push('\\end{rSection}');
    L.push('');
  }
  if(data.formacao.length){
    L.push('\\begin{rSection}{FORMAÇÃO}');
    data.formacao.forEach(f=>{
      const periodo = f.inicio + (f.fim?(' -- '+f.fim):'');
      L.push('  \\textbf{'+texEscape(f.instituicao)+'} \\hfill '+periodo+'\\\\');
      L.push('  '+texEscape([f.grau, f.area].filter(Boolean).join(', '))+(f.nota?(' \\hfill '+texEscape(f.nota)):'')+'');
      L.push('');
    });
    L.push('\\end{rSection}');
    L.push('');
  }
  if(data.habilidades.length){
    L.push('\\begin{rSection}{HABILIDADES}');
    L.push('  \\begin{tabular}{ @{} >{\\bfseries}l @{\\hspace{6ex}} l }');
    data.habilidades.forEach(s=> L.push('    '+texEscape(s.categoria)+' & '+texEscape(s.nome)+' \\\\'));
    L.push('  \\end{tabular}');
    L.push('\\end{rSection}');
    L.push('');
  }
  if(data.projetos.length){
    L.push('\\begin{rSection}{PROJETOS}');
    data.projetos.forEach(p=>{
      L.push('  \\textbf{'+texEscape(p.nome)+'} '+(p.stack&&p.stack.length?('\\hfill '+texEscape(p.stack.join(', '))):'')+'\\\\');
      L.push('  '+texEscape(p.descricao));
      if(p.destaques && p.destaques.length){
        L.push('  \\begin{itemize}\\itemsep -3pt {}');
        p.destaques.forEach(d=> L.push('    \\item '+texEscape(d)));
        L.push('  \\end{itemize}');
      }
      L.push('');
    });
    L.push('\\end{rSection}');
    L.push('');
  }
  if(data.idiomas.length){
    L.push('\\begin{rSection}{IDIOMAS}');
    L.push('  '+data.idiomas.map(i=> texEscape(i.idioma+' ('+i.proficiencia+')')).join(' \\textbullet{} '));
    L.push('\\end{rSection}');
    L.push('');
  }
  if(data.cursos.length){
    L.push('\\begin{rSection}{CERTIFICAÇÕES}');
    data.cursos.forEach(c=> L.push('  '+texEscape(c.titulo)+' \\hfill '+texEscape([c.emissor,c.data].filter(Boolean).join(', '))+'\\\\'));
    L.push('\\end{rSection}');
    L.push('');
  }
  L.push('\\end{document}');
  return L.join('\n');
}

// Traceability warnings (itens a revisar) for the "adaptado" preview.
const SAMPLE_AVISOS = [
  { valor:'liderei equipe', razao:'Removi a quantidade ("de 8 pessoas") porque o número não consta na sua base.', campo:'Experiência › Nubank › Realizações' },
  { valor:'reduzi latência p99', razao:'Reescrevi para destacar a palavra-chave da vaga; o resultado quantitativo não estava preenchido.', campo:'Experiência › Nubank › Realizações' },
  { valor:'Inglês (C1)', razao:'Mantive o nível informado na base; confirme se corresponde à exigência da vaga.', campo:'Idiomas' },
];

// Histórico de currículos gerados (cacheados — baixar não gasta nova geração)
const SAMPLE_HISTORY = [
  { id:'cv_03', mode:'adaptado', titulo:'Backend Pleno — Mercado Livre', data:'30 mai 2026 · 14:22', avisos:SAMPLE_AVISOS },
  { id:'cv_02', mode:'padrao', titulo:'Currículo padrão', data:'28 mai 2026 · 09:10', avisos:[] },
  { id:'cv_01', mode:'adaptado', titulo:'Engenheiro de Plataforma — iFood', data:'21 mai 2026 · 18:47',
    avisos:[ { valor:'arquitetei pipelines', razao:'Reescrevi para o vocabulário da vaga; verifique se reflete seu escopo real.', campo:'Experiência › Nubank › Realizações' } ] },
];

Object.assign(window, { SAMPLE, buildTex, SAMPLE_AVISOS, SAMPLE_HISTORY });
