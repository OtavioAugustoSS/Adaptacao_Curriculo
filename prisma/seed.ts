import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Seed de DESENVOLVIMENTO (ADR-0024): cria o usuário do FALLBACK de dev (LOCAL_USER_ID)
// com um Profile vazio, para trabalhar localmente sem passar pelo OAuth. Em PRODUÇÃO os
// usuários são provisionados pelo Auth.js no 1º login — este seed não deve rodar lá.
async function main() {
  if (process.env.NODE_ENV === "production") {
    console.log("Seed: ignorado em produção (usuários vêm do Auth.js).");
    return;
  }

  const id = process.env.LOCAL_USER_ID ?? "local-user";

  await prisma.user.upsert({
    where: { id },
    update: {},
    create: {
      id,
      profile: {
        create: { fullName: "Seu Nome" },
      },
    },
  });

  console.log(`Seed: usuário local '${id}' garantido.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
