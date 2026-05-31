/*
  Warnings:

  - Added the required column `name` to the `GeneratedResume` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GeneratedResume" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "jobPostingId" TEXT,
    "modelId" TEXT NOT NULL,
    "contentJson" TEXT NOT NULL,
    "texOutput" TEXT NOT NULL,
    "traceabilityReport" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GeneratedResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GeneratedResume_jobPostingId_fkey" FOREIGN KEY ("jobPostingId") REFERENCES "JobPosting" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
-- Backfill do `name` nos registros antigos (ADR-0021): coluna NOT NULL sem default no
-- banco. Compõe o nome com o rótulo do modo + a data do `createdAt` (dd/mm/aaaa), o
-- mesmo default que o app aplica em novas gerações. O Prisma guarda DateTime no SQLite
-- como inteiro epoch em MILISSEGUNDOS — convertemos para segundos (/1000) e usamos
-- 'unixepoch'; COALESCE garante NOT NULL mesmo se a data for inesperadamente nula.
INSERT INTO "new_GeneratedResume" ("contentJson", "createdAt", "id", "jobPostingId", "mode", "modelId", "name", "texOutput", "traceabilityReport", "userId") SELECT "contentJson", "createdAt", "id", "jobPostingId", "mode", "modelId", (CASE WHEN "mode" = 'JOB_ADAPTIVE' THEN 'Adaptado à vaga' ELSE 'Currículo padrão' END) || COALESCE(' — ' || strftime('%d/%m/%Y', "createdAt" / 1000, 'unixepoch'), ''), "texOutput", "traceabilityReport", "userId" FROM "GeneratedResume";
DROP TABLE "GeneratedResume";
ALTER TABLE "new_GeneratedResume" RENAME TO "GeneratedResume";
CREATE INDEX "GeneratedResume_userId_idx" ON "GeneratedResume"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
