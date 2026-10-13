// Bundles the MCP Apps widget (widget/main.ts + widget/widget.css) into one
// self-contained HTML document, which the MCP server serves as a ui://
// resource. Hosts render it in a sandbox that loads nothing from outside, so
// script and styles are inlined. Runs before dev, build, typecheck and tests.
import { writeFile } from "node:fs/promises";
import { build } from "esbuild";

const bundle = async (entry: string) => {
  const { outputFiles } = await build({
    entryPoints: [entry],
    bundle: true,
    minify: true,
    format: "iife",
    target: ["es2020", "chrome100", "safari15"],
    legalComments: "none",
    write: false,
  });
  return outputFiles[0].text.trim();
};
const [script, style] = await Promise.all([
  bundle("widget/main.ts"),
  bundle("widget/widget.css"),
]);
// An inline script ends at the first "</script", wherever it appears.
const inline = script
  .replace(/<\/(script)/gi, "<\\/$1")
  .replace(/<!--/g, "<\\!--");
const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>ModelPickr</title>
<style>${style}</style>
</head>
<body>
<main id="root"></main>
<script>${inline}</script>
</body>
</html>
`;
await writeFile("lib/mcp/widget.generated.json", JSON.stringify({ html }));
console.log(`Widget: ${(html.length / 1024).toFixed(0)} kB`);
