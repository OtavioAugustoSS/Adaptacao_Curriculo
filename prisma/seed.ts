import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Cria o usuário único do MVP (LOCAL_USER_ID) com um Profile vazio.
// É o id retornado pelo seam getCurrentUserId() enquanto não há autenticação.
async function main() {
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
