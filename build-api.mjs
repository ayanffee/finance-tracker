// Pre-bundle the /api Lambda so @vercel/node has one flat CJS file to serve.
// This avoids the module-resolution gymnastics @vercel/node has been doing.

import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

// Ensure target dir exists
fs.mkdirSync("api", { recursive: true });

await build({
  // Optional: run `node build-api.mjs` locally to smoke-test the Lambda bundle.
  // Vercel deploys via @vercel/node compiling api/index.cts directly; this
  // script is not part of the production build path.
  entryPoints: ["api/index.cts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  outfile: "api/index.js",
  sourcemap: false,
  minify: false,
  // Keep node built-ins external
  external: [
    "node:*",
    "crypto", "fs", "path", "http", "https", "net", "tls",
    "stream", "url", "util", "events", "buffer", "querystring",
    "string_decoder", "zlib", "os", "child_process",
    "worker_threads", "diagnostics_channel", "async_hooks", "perf_hooks",
    "dns", "assert", "module", "timers", "readline",
  ],
  // Silence noisy optional package imports that aren't actually used at runtime
  logLevel: "warning",
});

console.log("[build-api] wrote api/index.js");
