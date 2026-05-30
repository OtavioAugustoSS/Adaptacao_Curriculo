// Whitelist e limite do import de currículo por ARQUIVO (US-13, ADR-0019 §3).
//
// FONTE ÚNICA compartilhada pela rota (servidor) e pela UI (`accept` + pré-validação):
// PDF, DOCX e TXT, validados por MIME OU por extensão — porque o MIME do multipart nem
// sempre é confiável (o navegador pode mandar "" ou "application/octet-stream"). O corpo
// é binário, então não há schema Zod de request; a validação é tipo + tamanho.

/** MIMEs aceitos no import por arquivo (PDF, DOCX, TXT). */
export const ACCEPTED_IMPORT_MIME = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
] as const;

/** Extensões equivalentes às do `ACCEPTED_IMPORT_MIME` (fallback quando o MIME falha). */
export const ACCEPTED_IMPORT_EXTENSIONS = [".pdf", ".docx", ".txt"] as const;

/** Limite de tamanho do arquivo: 8 MB — cabe um currículo, barra uploads abusivos. */
export const MAX_IMPORT_FILE_BYTES = 8 * 1024 * 1024;

/**
 * String pronta para o atributo `accept` de um `<input type="file">`: junta os MIMEs
 * e as extensões (alguns SOs casam melhor por extensão, outros por MIME).
 */
export const IMPORT_FILE_ACCEPT = [
  ...ACCEPTED_IMPORT_MIME,
  ...ACCEPTED_IMPORT_EXTENSIONS,
].join(",");

/**
 * Decide se um arquivo é aceito no import, por MIME OU por extensão do nome.
 * Aceitar por extensão cobre o caso (comum em multipart) do MIME vir vazio/genérico.
 *
 * @param name Nome do arquivo (ex.: "curriculo.pdf"). A extensão é case-insensitive.
 * @param type MIME informado pelo cliente (pode ser "" ou impreciso).
 */
export function isAcceptedImportFile(name: string, type: string): boolean {
  const mimeOk = (ACCEPTED_IMPORT_MIME as readonly string[]).includes(type);
  const lower = name.toLowerCase();
  const extOk = ACCEPTED_IMPORT_EXTENSIONS.some((ext) => lower.endsWith(ext));
  return mimeOk || extOk;
}
