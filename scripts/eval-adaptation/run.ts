// Harness de avaliação da adaptação (ADR-0027 / Fatia 10). Lê a base REAL do usuário do
// banco, roda o Modo 2 contra uma vaga em N modelos e imprime um scorecard: tempo, erros do
// guardrail (rastreabilidade) e a contagem de bullets por item (output vs base) — o que mede
// se o modelo ENCOLHEU. NÃO entra no `npm test` (usa NIM real / budget). Rodar com tsx.

import { prisma } from "@/server/db";
import { NimProvider } from "@/server/llm/nim";
import { generateJobAdaptiveContent } from "@/server/resume/select-content";
import { validateTraceability } from "@/server/resume/validate-traceability";
import type { ProfileBundle } from "@/lib/schemas";

const MAGALU = `Sobre a vaga: A Magalu Cloud é a plataforma de serviços de computação em nuvem da Magazine Luiza. Buscamos Desenvolvedores Júnior e Pleno para criar os produtos da Magalu Cloud e desenvolver softwares robustos e eficientes.
Responsabilidades: Participar do desenvolvimento ágil; criar soluções escaláveis, seguras e confiáveis; aplicar boas práticas (testes automatizados, revisão de código, CI/CD); apoiar definição e documentação de arquiteturas; antecipar e resolver problemas de performance, segurança e escalabilidade.
Requisitos obrigatórios: Formação em Engenharia de Sistemas ou áreas correlatas; experiência com Python ou outra linguagem orientada a objetos (Go, Ruby); conhecimento em Microsserviços, Design Patterns e Arquitetura de Software; bancos de dados relacionais e cache distribuídos; testes automatizados (unitários e de integração); CI/CD, monitoramento, observabilidade; boas práticas de qualidade; vivência em ambiente ágil.
Requisitos desejáveis: DBs relacionais avançados, mensageria (Kafka/RabbitMQ), Kubernetes e Docker; aplicações em larga escala; inglês intermediário.`;

function arr(s: string): string[] {
  try {
    const a = JSON.parse(s);
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function u(v: string | null): string | undefined {
  return v ?? undefined;
}

async function loadBundle(): Promise<ProfileBundle | null> {
  const p = await prisma.profile.findFirst({
    where: { experiences: { some: {} } },
    include: {
      experiences: true,
      educations: true,
      skills: true,
      projects: true,
      languages: true,
      courses: true,
    },
  });
  if (!p) return null;
  const sort = <T extends { order: number }>(a: T[]) => [...a].sort((x, y) => x.order - y.order);
  return {
    profile: {
      id: p.id,
      userId: p.userId,
      fullName: p.fullName,
      phone: u(p.phone),
      location: u(p.location),
      email: u(p.email),
      linkedin: u(p.linkedin),
      github: u(p.github),
      website: u(p.website),
      summary: u(p.summary),
    },
    experiences: sort(p.experiences).map((e) => ({
      id: e.id, userId: e.userId, profileId: e.profileId, company: e.company, role: e.role,
      location: u(e.location), startDate: e.startDate, endDate: u(e.endDate), current: e.current,
      bullets: arr(e.bullets), order: e.order,
    })),
    educations: sort(p.educations).map((e) => ({
      id: e.id, userId: e.userId, profileId: e.profileId, institution: e.institution, degree: e.degree,
      field: u(e.field), startDate: e.startDate, endDate: u(e.endDate), current: e.current,
      gpa: u(e.gpa), details: u(e.details), order: e.order,
    })),
    skills: sort(p.skills).map((s) => ({
      id: s.id, userId: s.userId, profileId: s.profileId, category: s.category, name: s.name,
      level: u(s.level), order: s.order,
    })),
    projects: sort(p.projects).map((pr) => ({
      id: pr.id, userId: pr.userId, profileId: pr.profileId, name: pr.name, description: pr.description,
      bullets: arr(pr.bullets), techStack: arr(pr.techStack), url: u(pr.url), order: pr.order,
    })),
    languages: sort(p.languages).map((l) => ({
      id: l.id, userId: l.userId, profileId: l.profileId, name: l.name, proficiency: l.proficiency, order: l.order,
    })),
    courses: sort(p.courses).map((c) => ({
      id: c.id, userId: c.userId, profileId: c.profileId, title: c.title, issuer: c.issuer, date: c.date,
      url: u(c.url), order: c.order,
    })),
  };
}

async function run(modelId: string, bundle: ProfileBundle) {
  console.log(`\n===== MODELO: ${modelId} =====`);
  const provider = new NimProvider();
  const t = Date.now();
  try {
    const content = await generateJobAdaptiveContent(bundle, MAGALU, provider, modelId);
    const report = validateTraceability(content, bundle);
    const secs = ((Date.now() - t) / 1000).toFixed(0);
    console.log(`tempo: ${secs}s | guardrail ERROS: ${report.errors.length} | avisos: ${report.warnings.length}`);
    if (report.errors.length) console.log("  ERROS:", JSON.stringify(report.errors));
    console.log("OBJETIVO:", content.objective);
    let shrunk = 0;
    console.log("EXPERIÊNCIAS (output vs base):");
    for (const e of content.experience) {
      const base = bundle.experiences.find((b) => b.id === e.sourceId);
      const baseN = base?.bullets.length ?? -1;
      if (baseN >= 0 && e.bullets.length < baseN) shrunk++;
      console.log(`  - ${e.company}: ${e.bullets.length} (base ${baseN})${baseN >= 0 && e.bullets.length < baseN ? "  <-- ENCOLHEU" : ""}`);
    }
    console.log("PROJETOS (output vs base):");
    for (const pr of content.projects) {
      const base = bundle.projects.find((b) => b.id === pr.sourceId || b.name === pr.title);
      const baseN = base?.bullets.length ?? -1;
      const n = (pr.bullets ?? []).length;
      if (baseN >= 0 && n < baseN) shrunk++;
      console.log(`  - ${pr.title}: ${n} (base ${baseN})${baseN >= 0 && n < baseN ? "  <-- ENCOLHEU" : ""}`);
    }
    console.log(`RESUMO: itens encolhidos=${shrunk} | exp=${content.experience.length}/${bundle.experiences.length} | proj=${content.projects.length}/${bundle.projects.length}`);
  } catch (err) {
    const secs = ((Date.now() - t) / 1000).toFixed(0);
    console.log(`FALHOU em ${secs}s:`, err instanceof Error ? err.message : String(err));
  }
}

async function main() {
  const bundle = await loadBundle();
  if (!bundle) {
    console.log("Sem base no banco.");
    await prisma.$disconnect();
    return;
  }
  console.log("CONTAGENS DA BASE:");
  bundle.experiences.forEach((e) => console.log(`  exp ${e.company}: ${e.bullets.length}`));
  bundle.projects.forEach((p) => console.log(`  proj ${p.name}: ${p.bullets.length}`));

  const models = process.argv.slice(2);
  const toRun = models.length
    ? models
    : ["meta/llama-3.3-70b-instruct", "nvidia/llama-3.3-nemotron-super-49b-v1"];
  for (const m of toRun) await run(m, bundle);

  await prisma.$disconnect();
}

main();
