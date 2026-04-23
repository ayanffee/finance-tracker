// Minimal zero-dep lambda to probe whether @vercel/node can compile and
// run a .cts file at all, independent of the main api/index.cts.
export default function handler(req: any, res: any) {
  res.setHeader("content-type", "application/json");
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, cts: true, now: new Date().toISOString() }));
}
