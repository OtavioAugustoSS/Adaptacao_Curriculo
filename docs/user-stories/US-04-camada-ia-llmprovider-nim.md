# US-04 — Camada de IA: LLMProvider + adapter NIM

**Fatia:** 2 — Modo 1 (currículo padrão)
**Dependências:** nenhuma técnica direta (raiz da Fatia 2; usada por US-05)

## História

**Como** desenvolvedor do CV-Adapter,
**quero** uma interface `LLMProvider` trocável com um adapter NIM (cliente OpenAI-compatible da NVIDIA) e configuração de modelo por variável de ambiente,
**para** isolar todo acesso ao modelo atrás de um seam, permitindo trocar de provedor (incl. Claude) sem mexer no call site da geração.

## Descrição

- Definir a interface `LLMProvider` (`provider.ts`) — contrato único de acesso ao modelo (ex.: gerar `ResumeContent` estruturado a partir de prompt + input).
- Implementar o adapter NIM (`nim.ts`) usando o SDK `openai` apontado para `LLM_BASE_URL` com `LLM_API_KEY`.
- Catálogo de modelos + padrão (`models.ts`); modelo selecionado por `MODEL_ID` (env), base-URL por `LLM_BASE_URL`.
- O adapter retorna JSON validável por Zod (`ResumeContentSchema`), **nunca `.tex` cru** — saída estruturada.
- Tratamento de erro do LLM mapeável para status 502 no handler que o consome.

## Referências

- **Spec:** §3 (passos de chamada ao LLM nos dois modos — esta US entrega só a camada de acesso).
- **Contrato de API:** §3 `ResumeContentSchema` (forma da saída estruturada); status 502 (erro do LLM).
- **ERD:** `GeneratedResume.modelId` (modelo usado é persistido — consumo em US-05).
- **Código:** `src/server/llm/provider.ts`, `src/server/llm/nim.ts`, `src/server/llm/models.ts`, `src/server/llm/prompts/` (esqueleto), `src/lib/schemas/` (`ResumeContentSchema`).
- **Arquitetura:** §2 (IA via OpenAI-compatible → NIM), §5 (camada de IA abstraída), §9 (envs `LLM_BASE_URL`, `LLM_API_KEY`, `MODEL_ID`), ADR-0003, ADR-0004.

## Estados envolvidos

- Sucesso → JSON estruturado validado.
- Falha de rede/credencial/timeout do provedor → erro propagável (→ 502).
- Saída não conforme ao schema → erro de validação (tratado por quem consome).

## Fora do escopo

- Os prompts finais do Modo 1 e Modo 2 (`standard-cv.ts`, `job-adaptive-cv.ts`) — o conteúdo dos prompts pertence a US-05 (Modo 1) e US-08 (Modo 2); aqui só o seam.
- Orquestração base → LLM → render → persiste (US-05).
- Validação de rastreabilidade (US-07).

## Pendências

- [DECISÃO PENDENTE] A interface `LLMProvider` deve forçar saída estruturada (JSON mode / response_format) ou aceitar texto e validar depois? Confirmar se o NIM/modelo padrão suporta `response_format: json_schema`.
- [DECISÃO PENDENTE] Política de retry/timeout no adapter (nº de tentativas, backoff) — definir aqui ou deixar para o orquestrador (US-05/US-07)?
