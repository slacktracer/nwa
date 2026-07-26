// Dev server with on-the-fly TypeScript transpilation via esbuild
// Run: deno task serve

import * as esbuild from "npm:esbuild";

const PORT = 8080;
const ROOT = "./client";

const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

async function serveTS(filePath: string): Promise<Response> {
  const source = await Deno.readTextFile(filePath);
  const result = await esbuild.transform(source, {
    loader: "ts",
    format: "esm",
    target: "esnext",
    sourcefile: filePath,
  });
  return new Response(result.code, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}

function serveStatic(filePath: string): Response {
  const ext = filePath.slice(filePath.lastIndexOf("."));
  const contentType = MIME[ext] || "application/octet-stream";
  const data = Deno.readFileSync(filePath);
  return new Response(data, {
    headers: { "content-type": contentType, "cache-control": "no-cache" },
  });
}

Deno.serve({ port: PORT, hostname: "0.0.0.0" }, async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = `${ROOT}${pathname}`;

  // Transpile TypeScript on the fly
  if (filePath.endsWith(".ts")) {
    try {
      return await serveTS(filePath);
    } catch (e) {
      if (e instanceof Deno.errors.NotFound) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(`Transform error: ${e}`, { status: 500 });
    }
  }

  // Static files
  try {
    return serveStatic(filePath);
  } catch {
    return new Response("Not Found", { status: 404 });
  }
});

console.log(`NWA dev server → http://localhost:${PORT}`);
