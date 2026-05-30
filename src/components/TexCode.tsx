"use client";

// Bloco de código .tex com realce leve (comandos LaTeX + comentários), recriando
// o CodeTex do protótipo (docs/design/claude-design/app/gerar.jsx).
//
// Segurança: escapamos &<> ANTES de injetar os <span> de realce, então o conteúdo
// do usuário/LLM nunca é interpretado como HTML. O `.tex` exibido é o real
// (resume.texOutput vindo do renderer), nunca um mock.

import { useMemo } from "react";

function highlight(tex: string): string {
  return tex
    .split("\n")
    .map((line) => {
      const escaped = line.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c] as string);
      // Linha de comentário inteira.
      if (/^\s*%/.test(escaped)) return `<span class="c">${escaped}</span>`;
      // Realça \comandos.
      return escaped.replace(/(\\[a-zA-Z]+)/g, '<span class="k">$1</span>');
    })
    .join("\n");
}

export function TexCode({ tex }: { tex: string }) {
  const html = useMemo(() => highlight(tex), [tex]);
  return (
    <div className="code" style={{ maxHeight: 520 }}>
      <pre dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
