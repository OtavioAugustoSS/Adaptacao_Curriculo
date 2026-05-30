// PostCSS pipeline — Tailwind CSS v4 plugin oficial (ADR-0017).
// v4 embute @import e prefixing; não declarar autoprefixer/postcss-import.
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
