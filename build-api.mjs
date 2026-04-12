import { build } from "esbuild";

await build({
  entryPoints: ["api/_handler.ts"],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: "api/index.js",
  // Bundle everything except Node.js builtins
  external: [
    "node:*",
    "crypto",
    "fs",
    "path",
    "http",
    "https",
    "net",
    "tls",
    "stream",
    "url",
    "util",
    "events",
    "buffer",
    "querystring",
    "string_decoder",
    "zlib",
    "os",
    "child_process",
    "worker_threads",
    "diagnostics_channel",
    "async_hooks",
    "perf_hooks",
  ],
  banner: {
    js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
  },
});

console.log("✓ API bundled to api/index.js");
