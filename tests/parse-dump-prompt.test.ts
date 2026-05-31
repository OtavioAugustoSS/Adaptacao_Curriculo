import { describe, it, expect } from "vitest";
import {
  PARSE_DUMP_SYSTEM_PROMPT,
  buildParseDumpPrompts,
} from "@/server/llm/prompts/parse-dump";

// Testes de COMPORTAMENTO do prompt do import por dump (US-11, ADR-0018).
// O prompt é a 1ª camada de proteção do import (extração ≠ geração: não há base de
// referência, então o guardrail de rastreabilidade não roda — a trava vive AQUI).
// Verificamos as instruções LOAD-BEARING (não o texto literal inteiro): anti-invenção,
// "deixe vazio o que faltar", o formato-alvo (ProfileBundle SEM ids), a regra de
// "current" e o idioma PT-BR. E que buildParseDumpPrompts injeta o rawText no user.

describe("PARSE_DUMP_SYSTEM_PROMPT — travas anti-invenção", () => {
  it("deve instruir explicitamente a NÃO inventar", () => {
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("NÃO INVENTE");
  });

  it("deve mandar deixar VAZIO o que não aparecer no texto (em vez de inferir)", () => {
    expect(PARSE_DUMP_SYSTEM_PROMPT).toMatch(/deixe-?o? +VAZIO|deixe.+VAZIO/);
    // Reforço: a regra de não inferir/completar está presente.
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("NÃO infira");
  });

  it("deve dizer para usar SOMENTE o que está no texto do próprio usuário", () => {
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("SOMENTE o que está no texto");
  });
});

describe("PARSE_DUMP_SYSTEM_PROMPT — formato da saída (ProfileBundle sem ids)", () => {
  it("deve declarar as chaves do bundle-alvo", () => {
    for (const key of [
      "profile",
      "experiences",
      "educations",
      "skills",
      "projects",
      "languages",
      "courses",
    ]) {
      expect(PARSE_DUMP_SYSTEM_PROMPT).toContain(`"${key}"`);
    }
  });

  it("deve proibir incluir ids (id/userId/profileId)", () => {
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("SEM nenhum id");
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("userId");
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("profileId");
  });

  it("deve pedir um único objeto JSON, sem markdown nem texto fora do JSON", () => {
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("único objeto JSON");
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("sem markdown");
  });
});

describe("PARSE_DUMP_SYSTEM_PROMPT — completude (ADR-0020: capturar tudo)", () => {
  it("deve reforçar a captura completa (não resumir nem omitir itens reais)", () => {
    // O import também precisa ser COMPLETO: capturar TODAS as listas que o texto traz,
    // incluindo bullets/techStack dos projetos e idiomas/cursos.
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("CAPTURE TUDO");
    expect(PARSE_DUMP_SYSTEM_PROMPT).toMatch(/TODAS as experiências/);
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("techStack");
    expect(PARSE_DUMP_SYSTEM_PROMPT).toMatch(/idiomas/);
    expect(PARSE_DUMP_SYSTEM_PROMPT).toMatch(/cursos\/certificações/);
  });
});

describe("PARSE_DUMP_SYSTEM_PROMPT — regra de current (US-12) e idioma", () => {
  it("deve instruir current: true apenas quando o item está EM ANDAMENTO", () => {
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain("EM ANDAMENTO");
    expect(PARSE_DUMP_SYSTEM_PROMPT).toContain('"current": true');
  });

  it("deve estar em PT-BR (idioma do produto)", () => {
    // Marcadores inequívocos de português (acentos + termos do domínio em PT).
    expect(PARSE_DUMP_SYSTEM_PROMPT).toMatch(/usuário|formações|habilidades/);
  });
});

describe("buildParseDumpPrompts — montagem do par system/user", () => {
  const RAW_TEXT = "Otávio — dev backend desde 2020, cursando mestrado.";

  it("deve usar o system fixo (PARSE_DUMP_SYSTEM_PROMPT)", () => {
    const { system } = buildParseDumpPrompts(RAW_TEXT);
    expect(system).toBe(PARSE_DUMP_SYSTEM_PROMPT);
  });

  it("deve injetar o rawText no user prompt", () => {
    const { user } = buildParseDumpPrompts(RAW_TEXT);
    expect(user).toContain(RAW_TEXT);
  });

  it("deve reforçar no user prompt a regra de não inventar / deixar vazio", () => {
    const { user } = buildParseDumpPrompts(RAW_TEXT);
    expect(user).toMatch(/não invente/i);
  });
});
