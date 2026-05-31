-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneratedResume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "jobPostingId" TEXT,
    "modelId" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "texOutput" TEXT NOT NULL,
    "traceabilityReport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedResume_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GeneratedResume" ("contentJson", "createdAt", "id", "jobPostingId", "mode", "modelId", "name", "texOutput", "traceabilityReport", "userId") SELECT "contentJson", "createdAt", "id", "jobPostingId", "mode", "modelId", "name", "texOutput", "traceabilityReport", "userId" FROM "GeneratedResume";
DROP TABLE "GeneratedResume";
ALTER TABLE "new_GeneratedResume" RENAME TO "GeneratedResume";
CREATE INDEX "GeneratedResume_userId_idx" ON "GeneratedResume"("userId");
-- Backfill do currículo padrão (ADR-0022): por usuário, marca como padrão o STANDARD mais
-- recente (ou, na falta de STANDARD, o currículo mais recente). Garante "pelo menos um
-- padrão" nos dados existentes. Sem window functions (portável); seleciona, por usuário, a
-- linha para a qual NÃO existe outra "melhor" — STANDARD vence não-STANDARD, e dentro da
-- mesma classe vence o `createdAt` mais novo, com desempate por `id` para garantir 1 só.
UPDATE "GeneratedResume"
SET "isDefault" = 1
WHERE "id" IN (
  SELECT g."id" FROM "GeneratedResume" g
  WHERE NOT EXISTS (
    SELECT 1 FROM "GeneratedResume" g2
    WHERE g2."userId" = g."userId"
      AND (
        (CASE WHEN g2."mode" = 'STANDARD' THEN 1 ELSE 0 END) > (CASE WHEN g."mode" = 'STANDARD' THEN 1 ELSE 0 END)
        OR (
          (CASE WHEN g2."mode" = 'STANDARD' THEN 1 ELSE 0 END) = (CASE WHEN g."mode" = 'STANDARD' THEN 1 ELSE 0 END)
          AND (
            g2."createdAt" > g."createdAt"
            OR (g2."createdAt" = g."createdAt" AND g2."id" > g."id")
          )
        )
      )
  )
);
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
