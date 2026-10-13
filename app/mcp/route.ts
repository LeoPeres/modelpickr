// MCP endpoint (Streamable HTTP, stateless) for ChatGPT, Claude and other MCP
// hosts. Only POST exists: the server never pushes, so Next.js answers GET and
// DELETE with the 405 the protocol expects.
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getCatalog } from "@/lib/catalog/server";
import { createMcpServer } from "@/lib/mcp/server";
import widget from "@/lib/mcp/widget.generated.json";

// Public read-only data, so any origin may call it (browser-based MCP clients).
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Accept, Authorization, Mcp-Session-Id, Mcp-Protocol-Version",
};

/** `SITE_URL` wins; otherwise the host the request came through. */
function siteOrigin(request: Request) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, "");
  const url = new URL(request.url);
  const first = (name: string) =>
    request.headers.get(name)?.split(",")[0].trim() || null;
  const host = first("x-forwarded-host") ?? first("host") ?? url.host;
  const proto = first("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const server = createMcpServer({
    catalog: await getCatalog(),
    origin: siteOrigin(request),
    widgetHtml: widget.html,
  });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  for (const [name, value] of Object.entries(cors))
    response.headers.set(name, value);
  return response;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}
