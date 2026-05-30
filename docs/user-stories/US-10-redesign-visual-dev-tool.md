# US-10 — Redesign visual dev-tool (casca + Início + Perfil + Gerar + Currículos) com design system, Tailwind e tema light+dark

**Fatia:** 4 — Polimento visual
**Dependências:** US-02, US-03 (Perfil), US-05, US-06, US-08 (Gerar), US-09 (Currículos) — todas concluídas. Depende do **ADR-0017** (setup Tailwind + mapeamento dos tokens do design system).

## História

**Como** usuário,
**quero** que toda a aplicação tenha uma interface coesa e moderna (estilo dev-tool — Linear/Vercel/Raycast), com casca de navegação, tema claro/escuro e estados visuais cuidados em cada tela,
**para** usar o CV-Adapter com uma experiência agradável e profissional, sem que nada do comportamento ou das garantias do produto mude.

## Descrição

Recriar no app Next.js real o design aprovado (reference impl em `docs/design/claude-design/`),
portando o visual para **Tailwind CSS** com os tokens do design system. **Apenas apresentação** —
nenhuma rota, schema, lógica de negócio ou contrato Zod muda. O `.tex` continua vindo do renderer
real (`render-latex.ts`, cacheado via `GET /api/resumes/[id]/download`); a invariante
anti-alucinação e o guardrail de 3 camadas permanecem **inalterados**.

Entregar: a **casca** (sidebar + nav + tema + drawer mobile) e o redesign das **5 telas** (Início,
Perfil, Gerar, Currículos), com **todos os estados** abaixo.

## Referências

- **Spec:** §2.1 (Perfil), §2.2 (Gerar), §2.3 (Currículos), §3 (fluxos dos modos), §4 (regra inegociável na UI).
- **Brief de design:** `docs/fatia-4-design.md` (decisões travadas, tokens, telas+estados, notas de fidelidade).
- **Reference impl:** `docs/design/claude-design/app/{shell,home,perfil,gerar,curriculos}.jsx` + `app/cv.css` (tokens) + `screenshots/`.
- **Contrato de API (read-only, congelado):** `GET /api/profile`, `PUT /api/profile`, `POST /api/generate`, `GET /api/resumes`, `GET /api/resumes/[id]/download`. `TraceabilityReportSchema = { errors: Issue[], warnings: Issue[] }`, `Issue = { field, value, reason }`.
- **ERD:** sem mudança. `nav-sub`/chips da Home derivam de `GET /api/profile` e `GET /api/resumes` no cliente.
- **Código:** `src/app/layout.tsx`, `src/app/(dashboard)/{perfil,gerar,curriculos}/page.tsx`, página inicial (Início), `src/components/` (shell + componentes do DS), `tailwind.config`/CSS global.
- **Arquitetura/ADRs:** ADR-0017 (Tailwind + tokens), ADR-0016 (título do card = rótulo do modo, sem título da vaga), ADR-0007/0008 (renderer + guardrail intactos), ADR-0011 (contrato congelado).

## Decisões de produto travadas nesta US

1. **Título do card em Currículos = rótulo do modo**, não título/empresa da vaga. Modo 1 → "Currículo padrão"; Modo 2 → "Currículo adaptado à vaga". **ADR-0016 mantido, contrato intacto.** O nome do arquivo `.tex` e a data acompanham o card como metadados.
2. **Nenhum dado/campo inventado pela UI.** Tudo que aparece sai da base do usuário ou do response da API. Chips/contagens são derivados dos dados reais; quando não há dado, exibir o estado vazio — nunca placeholders fictícios.
3. **Copy em PT-BR**, reaproveitando os textos do reference impl (saudações, hints, mensagens de estado, rótulos de botão).
4. **Sem mudança de comportamento ou lógica de negócio.** Pré-requisitos, fluxos dos dois modos, regeneração por guardrail e formato do `.tex` permanecem idênticos ao MVP. Esta US troca somente a camada visual.
5. **Avisos de rastreabilidade** são renderizados a partir de `traceabilityReport.warnings` (campos reais `field`/`value`/`reason`) **em qualquer modo** (Modo 1 também pode ter avisos). `errors` **nunca** aparecem na UI — disparam regeneração no backend. O breadcrumb mais rico do protótipo (`valor`/`razao`/`campo`) é só mock; usar os três campos reais como vierem.
6. **Remover o `.demobar` ("Estados")** do reference impl em todas as telas — é andaime de protótipo. No app real os estados são de runtime (loading/erro/dados reais).

## Critérios de aceite — Casca (shell + navegação + tema)

- [ ] **Sidebar** fixa (240px em desktop) com brand "CV-Adapter" (logo "cv") clicável que leva ao Início.
- [ ] **Nav** com 4 itens na ordem **Início · Perfil · Gerar · Currículos**, cada um com ícone e rótulo.
- [ ] **Estado ativo** do item atual: fundo `surface-2` + cor de acento + barra vertical de 3px; e `aria-current="page"` no item ativo.
- [ ] **`nav-sub` (contagem)** ao lado de Perfil ("N itens", soma das 6 listas da base) e Currículos (qtd. do histórico), **derivados** de `GET /api/profile` e `GET /api/resumes` — sem novo endpoint. Em estado de carregamento ou base vazia, a contagem não exibe número fictício (ocultar ou mostrar zero conforme o dado real).
- [ ] **Toggle de tema** (segmento Light/Dark) no rodapé da sidebar; tema **persistido** (chave `cv-theme`, default coerente com o reference) e aplicado via `data-theme` no `<html>`; `aria-pressed` reflete o tema atual.
- [ ] **Drawer mobile** (<820px): topbar com botão de menu (`aria-label`), brand e rótulo da tela atual; abrir o menu desliza a sidebar com **scrim** clicável que fecha; navegar fecha o drawer.
- [ ] **Light e dark** ambos completos e legíveis em todas as telas; respeitar `prefers-reduced-motion`.

## Critérios de aceite — Início (Home)

- [ ] **Saudação** com o primeiro nome do usuário ("Olá, <nome>.") quando a base tem nome; fallback neutro quando não há nome.
- [ ] **Chips de status da base** (derivados dos dados reais): contagens de experiências, projetos e habilidades, com plural correto (1 → singular).
- [ ] **3 atalhos** (cards) para Perfil, Gerar e Currículos, cada um com ícone, título e descrição curta, navegáveis.
- [ ] **Estado base vazia:** em vez dos chips, exibir callout de acento "Sua base ainda está vazia" com link para o Perfil; os 3 atalhos continuam visíveis.

## Critérios de aceite — Perfil

- [ ] **Cabeçalho da página** (título "Perfil" + subtítulo explicando que é a fonte da verdade).
- [ ] **Seção Cabeçalho e resumo:** grid de campos (nome\*, e-mail, telefone, localização, website, linkedin, github, resumo) com labels, marcação de obrigatório (`*`), placeholders/help em `fg-muted`.
- [ ] **6 listas** — Experiência, Formação, Habilidades, Projetos, Idiomas, Cursos/Certificações — cada uma com: ícone+título+contagem, botão **Adicionar**, e por item um card editável com **mover para cima/baixo** (reordenar, desabilitado nos extremos), **remover**, e campos da seção (incluindo `bullets`, `tags` e `toggle` "Emprego atual" que desabilita "Fim").
- [ ] **Barra de salvar fixa** no rodapé com mensagem contextual à esquerda e botão **Salvar** à direita.
- [ ] **Estados por campo/tela:**
  - **Carregando:** skeletons no lugar do conteúdo (`aria-busy`).
  - **Pronto/preenchido:** dados reais editáveis.
  - **Vazio:** callout "Sua base ainda está vazia" + listas mostrando o card de "Adicionar <singular>" com a dica de vazio.
  - **Salvando:** botão em estado "Salvando…" com spinner; ação desabilitada.
  - **Salvo:** badge de sucesso "Salvo com sucesso" (transitório).
  - **Erro de validação (Zod):** campos com borda de erro + mensagem em `help err`; badge "Erro de validação"; mensagem na savebar pedindo correção. As mensagens de erro vêm da validação real (Zod/`details`), não de mock.

## Critérios de aceite — Gerar

- [ ] **Cabeçalho** (título "Gerar currículo" + subtítulo reforçando "usa apenas itens reais — nunca inventa; saída é `.tex` para o Overleaf").
- [ ] **Tabs Padrão / Adaptar à vaga** (segmentadas, `role=tablist`/`aria-selected`), com hint de modo abaixo.
- [ ] **Modo Adaptar:** textarea grande da vaga (label + help "Cole a descrição da vaga para habilitar a adaptação"); botão primário desabilitado enquanto a vaga estiver vazia, com aviso "Cole a vaga para habilitar".
- [ ] **Botão primário** com rótulo por modo: "Gerar currículo padrão" / "Adaptar à vaga".
- [ ] **Estados:**
  - **Validando pré-requisitos:** skeleton de preview (`aria-busy`).
  - **Base insuficiente:** callout de aviso explicando o mínimo (nome + ≥1 experiência ou formação) com link para o Perfil; botão desabilitado.
  - **Ocioso:** formulário pronto, sem preview.
  - **Gerando:** botão "Gerando…" com spinner + texto "Chamando a IA — pode levar alguns segundos"; textarea desabilitada.
  - **Erro do LLM:** callout de perigo "Não foi possível gerar o currículo" + reassurance ("sua base está intacta") + botão **Tentar novamente** (retry da chamada real).
  - **Preview:** ver abaixo.
- [ ] **Preview do resultado:**
  - Título do bloco conforme o modo ("Currículo adaptado à vaga (.tex)" / "Currículo gerado (.tex)").
  - Botão **Copiar** que vira **"Copiado!"** (feedback transitório, ~2s) e copia o `.tex` real.
  - Botão **Baixar .tex** que baixa o `texOutput` real (não um mock JS).
  - **Avisos de rastreabilidade numerados** (`01`, `02`, …) renderizados de `traceabilityReport.warnings` quando `warnings.length > 0`, em **qualquer modo**, cada um mostrando os campos reais `value`/`reason`/`field` — com copy "Nada foi inventado — confira cada ajuste". Sem avisos → não exibir o bloco (ou indicar "sem avisos").
  - **Bloco `.tex`** em fonte mono, com o conteúdo gerado real, scroll vertical e (opcional) realce leve de comandos LaTeX.

## Critérios de aceite — Currículos

- [ ] **Cabeçalho** (título "Meus currículos" + subtítulo "baixe o `.tex` cacheado sem gastar nova geração e revise os avisos").
- [ ] **Cards de currículo**, cada um com:
  - **Emblema `.tex`** com cor por modo.
  - **Título = rótulo do modo** ("Currículo padrão" / "Currículo adaptado à vaga") + **badge de modo** ("Padrão" / "Adaptado"). **Nunca** título/empresa da vaga (ADR-0016).
  - **Data** (formatada) + nome do arquivo (`<id>.tex`) em mono.
  - **Meta faangpath:** "template faangpath · pronto para o Overleaf".
  - **Avisos de rastreabilidade expansíveis:** "Sem avisos de rastreabilidade" quando `warnings.length === 0`; caso contrário botão "N aviso(s) de rastreabilidade" (`aria-expanded`) que abre a lista numerada (mesmos campos reais `value`/`reason`/`field`).
  - **Baixar .tex** que rebaixa o `texOutput` cacheado via `GET /api/resumes/[id]/download` — **sem nova chamada ao LLM**.
- [ ] **Estados:**
  - **Carregando:** skeletons de card (`aria-busy`).
  - **Erro:** callout de perigo "Não foi possível carregar o histórico" + **Tentar novamente** (refetch real).
  - **Vazio:** empty-state "Nenhum currículo ainda" + CTA "Gerar meu primeiro currículo" → Gerar.
  - **Populado:** lista de cards a partir de `GET /api/resumes` (dados reais).

## Estados envolvidos (resumo)

- **Casca:** desktop/mobile (drawer aberto/fechado), tema light/dark, item ativo.
- **Início:** base vazia / base preenchida.
- **Perfil:** carregando / pronto / vazio / salvando / salvo / erro de validação (por campo).
- **Gerar:** validando / base insuficiente / ocioso / gerando / erro / preview (com avisos / sem avisos).
- **Currículos:** carregando / erro / vazio / populado (+ avisos expandidos por card).

## Fora do escopo

- Qualquer mudança no contrato Zod, rotas, schemas, prisma ou lógica de geração/guardrail (US-04/05/07/08 permanecem como estão).
- Exibir título/empresa da vaga no histórico (vetado por ADR-0016 — exigiria mudar o contrato congelado).
- Compilação para PDF (Overleaf segue externo).
- Autenticação real, paginação do histórico, exclusão/edição de currículos.
- Novos campos, novas seções da base, ou seleção de modelo na UI (modelo segue por env).
- Copiar a **estrutura interna** do protótipo (HTML/CSS/JS) — recria-se o visual em Tailwind; o protótipo é referência de aparência, não de arquitetura.

## Pendências

- [DECISÃO PENDENTE — RESOLVIDA] **Tema default (light vs dark)?** → Manter o default do reference impl (**dark**), persistido em `cv-theme`. Ambos os temas são obrigatórios e devem ficar legíveis.
- [DECISÃO PENDENTE — RESOLVIDA] **Conteúdo dos avisos na UI:** usar os três campos reais do contrato (`field`, `value`, `reason`), renderizados como vierem — **não** reproduzir o breadcrumb mais rico do mock (`valor`/`razao`/`campo`). Contrato intacto.
- [DECISÃO PENDENTE — RESOLVIDA] **Título do card de Currículos:** rótulo do modo, não título da vaga (ADR-0016).
- [DECISÃO PENDENTE — RESOLVIDA] **`.demobar` ("Estados"):** removido do app — é andaime de protótipo; estados passam a ser de runtime.
- [DECISÃO PENDENTE] **Formatação da data no card de Currículos:** o reference usa uma string já formatada (mock). Confirmar o formato PT-BR a exibir a partir de `GeneratedResume.createdAt` (ex.: `30/05/2026` ou `30 mai 2026`). **Sugestão:** `dd/mm/aaaa` para consistência com a localidade PT-BR.
- [DECISÃO PENDENTE] **Nome de arquivo no card:** o reference exibe `<id>.tex`. Confirmar se a convenção final de nome (definida em US-06/ADR-0014) deve ser refletida aqui também (ex.: `curriculo-<id>.tex`) para o usuário ver o mesmo nome que será baixado.
