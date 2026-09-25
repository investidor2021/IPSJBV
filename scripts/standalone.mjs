// Depois do vite build, embute JS, CSS e dados dentro do dist/index.html.
// Assim o painel abre com dois cliques no arquivo (file://), onde o navegador
// bloqueia o carregamento de scripts de módulo e o fetch do JSON.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = join(import.meta.dirname, "..", "dist");
let html = readFileSync(join(dist, "index.html"), "utf8");
// "</" dentro de um <script> fecharia a tag antes da hora
const seguro = texto => texto.replaceAll("</", "<\\/");

html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/, (_, arquivo) =>
  `<script type="module">${seguro(readFileSync(join(dist, arquivo), "utf8"))}</script>`);
html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/, (_, arquivo) =>
  `<style>${readFileSync(join(dist, arquivo), "utf8")}</style>`);

const dados = readFileSync(join(dist, "data", "ipsjbv.json"), "utf8");
html = html.replace("</head>", `<script>window.__IPSJBV_DATA__=${seguro(dados)};</script></head>`);

if (html.includes('src="./assets/') || html.includes('href="./assets/')) {
  throw new Error("standalone: não encontrei o script ou o CSS gerado pelo Vite para embutir");
}
writeFileSync(join(dist, "index.html"), html);
console.log(`dist/index.html autônomo gerado (${(html.length / 1024 / 1024).toFixed(1)} MB)`);
