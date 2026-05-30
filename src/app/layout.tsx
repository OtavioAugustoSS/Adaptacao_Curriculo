import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Fontes do DS via next/font/google (ADR-0017 §2): self-host, sem FOUT, sem
// request externo. As variáveis CSS são consumidas pelo @theme em globals.css.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: "CV-Adapter",
  description: "Adaptação de currículos com IA para o template faangpath (Overleaf).",
};

// Tema controlado por data-theme no <html> (ADR-0017 §4). Default dark
// (US-10, decisão do dono). Este script roda antes da hidratação para aplicar
// o tema persistido em localStorage (chave cv-theme) e evitar flash de tema.
const themeInitScript = `(function(){try{var t=localStorage.getItem('cv-theme');if(t!=='light'&&t!=='dark')t='dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="dark"
      className={`${geist.variable} ${geistMono.variable}`}
      // O script de boot ajusta data-theme antes da hidratação (tema persistido em
      // localStorage). Suprimimos o aviso de mismatch APENAS deste atributo do <html>.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
