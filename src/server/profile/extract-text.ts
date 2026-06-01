// Fronteira única arquivo -> texto do import por arquivo (US-13, ADR-0019 §2).
//
// Espelha a filosofia de fronteira única do escape-latex.ts: TODO arquivo enviado passa
// por aqui para virar texto, num único ponto auditável e testável (mocks de unpdf/mammoth,
// sem rede). O texto resultante alimenta o EXISTENTE extractProfileFromDump — daí em diante
// o fluxo é idêntico ao import por texto (Fatia 5). Roda só no servidor (Node): as libs de
// parsing usam Buffer/streams e não rodam no edge.
//
// Despacho por tipo (whitelist em src/lib/import-file.ts):
//   PDF  -> unpdf (getDocumentProxy + extractText { mergePages: true })
//   DOCX -> mammoth.extractRawText({ buffer })  (precisa de Buffer do Node)
//   TXT  -> TextDecoder utf-8 (sem lib)
// SEM OCR (ADR-0019 §5): PDF imagem/digitalizado devolve texto vazio; a rota mapeia a 422.

import { isAcceptedImportFile } from "@/lib/import-file";
import { stripNul } from "@/server/data/sanitize";

/**
 * Tipo de arquivo fora da whitelist (nem PDF, nem DOCX, nem TXT). A rota mapeia a 415
 * (UNSUPPORTED_MEDIA_TYPE). Erro tipado para o `catch` distinguir do resto.
 */
export class UnsupportedFileTypeError extends Error {
  constructor(message = "Tipo de arquivo não suportado.") {
    super(message);
    this.name = "UnsupportedFileTypeError";
  }
}

interface ExtractTextInput {
  /** Bytes do arquivo (lidos da requisição multipart). */
  bytes: Uint8Array;
  /** MIME informado pelo cliente (pode ser impreciso — daí também olhar o nome). */
  mimeType: string;
  /** Nome do arquivo, usado como fallback de tipo pela extensão. */
  fileName: string;
}

// `.docx` por extensão e o MIME oficial do DOCX. O despacho prioriza a evidência mais
// forte de cada formato, mas tolera MIME ausente caindo na extensão do nome.
const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function looksLikePdf(mimeType: string, fileName: string): boolean {
  return mimeType === PDF_MIME || fileName.toLowerCase().endsWith(".pdf");
}

function looksLikeDocx(mimeType: string, fileName: string): boolean {
  return mimeType === DOCX_MIME || fileName.toLowerCase().endsWith(".docx");
}

/**
 * Extrai o texto de um arquivo de currículo. NÃO valida tamanho (é da rota) e NÃO faz
 * `.trim()` nem detecta vazio (é a rota que decide o 422); apenas converte bytes -> texto.
 *
 * @throws {UnsupportedFileTypeError} se o tipo/extensão não estiver na whitelist.
 * @throws propaga erros das libs de parsing (PDF/DOCX corrompido) -> a rota mapeia a 500.
 */
export async function extractTextFromFile(input: ExtractTextInput): Promise<string> {
  const { bytes, mimeType, fileName } = input;

  if (!isAcceptedImportFile(fileName, mimeType)) {
    throw new UnsupportedFileTypeError(
      "Tipo de arquivo não suportado. Envie um PDF, DOCX ou TXT.",
    );
  }

  // PDF -> unpdf (JS puro, serverless). Import dinâmico: a lib (wrap do pdfjs) só carrega
  // quando há um PDF de fato, sem pesar o cold start das outras rotas.
  // `stripNul`: extração de PDF/DOCX pode emitir o byte NUL, que o Postgres rejeita no
  // save (erro 22021). Limpamos na fronteira de extração para o texto já sair são.
  if (looksLikePdf(mimeType, fileName)) {
    const { getDocumentProxy, extractText } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });
    return stripNul(text);
  }

  // DOCX -> mammoth. A API só aceita Buffer do Node (não Uint8Array cru), então converte.
  if (looksLikeDocx(mimeType, fileName)) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return stripNul(value);
  }

  // TXT (ou qualquer item da whitelist que sobrou): decodifica como UTF-8, sem lib.
  return stripNul(new TextDecoder("utf-8").decode(bytes));
}
