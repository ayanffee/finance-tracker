/**
 * Tiny HS256 JWT signer/verifier using Node's built-in `crypto`.
 *
 * This replaces `jose` (which is ESM-only in v6 and fails to load when
 * @vercel/node compiles our Lambda as CommonJS, causing FUNCTION_INVOCATION_FAILED).
 *
 * Output format matches RFC 7519 + RFC 7515 compact serialization, so tokens
 * signed here verify identically to jose-signed tokens (same secret, same alg).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function b64urlEncode(input: Buffer | Uint8Array | string): string {
  const buf =
    typeof input === "string"
      ? Buffer.from(input, "utf8")
      : Buffer.from(input);
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(input: string): Buffer {
  const padLen = (4 - (input.length % 4)) % 4;
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  return Buffer.from(padded, "base64");
}

function toKeyBuffer(secret: Uint8Array | Buffer | string): Buffer {
  if (typeof secret === "string") return Buffer.from(secret, "utf8");
  if (Buffer.isBuffer(secret)) return secret;
  return Buffer.from(secret);
}

/**
 * Sign a payload as an HS256 JWT.
 *
 * @param payload  JSON-serializable claims object (e.g. { userId, email }).
 *                 If you pass `exp` / `iat` inside `payload`, they are kept.
 *                 Otherwise the options below control them.
 * @param secret   Signing key as Uint8Array / Buffer / string.
 * @param opts.expirationTimeSeconds  Absolute `exp` (seconds since epoch).
 *                                    If omitted, `exp` is not set.
 * @param opts.typ Header `typ` (defaults to "JWT").
 */
export async function signJwtHS256(
  payload: Record<string, unknown>,
  secret: Uint8Array | Buffer | string,
  opts: { expirationTimeSeconds?: number; typ?: string } = {},
): Promise<string> {
  const header = { alg: "HS256" as const, typ: opts.typ ?? "JWT" };
  const body: Record<string, unknown> = {
    iat: Math.floor(Date.now() / 1000),
    ...payload,
  };
  if (opts.expirationTimeSeconds !== undefined && body.exp === undefined) {
    body.exp = opts.expirationTimeSeconds;
  }

  const headerB64 = b64urlEncode(JSON.stringify(header));
  const payloadB64 = b64urlEncode(JSON.stringify(body));
  const signingInput = `${headerB64}.${payloadB64}`;

  const signature = createHmac("sha256", toKeyBuffer(secret))
    .update(signingInput)
    .digest();

  return `${signingInput}.${b64urlEncode(signature)}`;
}

/**
 * Verify an HS256 JWT and return the decoded payload.
 * Throws on invalid format / bad signature / wrong algorithm / expired token.
 */
export async function verifyJwtHS256(
  token: string,
  secret: Uint8Array | Buffer | string,
): Promise<{ payload: Record<string, unknown>; protectedHeader: { alg: string; typ?: string } }> {
  if (typeof token !== "string") throw new Error("Invalid token");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid token format");
  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg?: string; typ?: string };
  try {
    header = JSON.parse(b64urlDecode(headerB64).toString("utf8"));
  } catch {
    throw new Error("Invalid token header");
  }
  if (header.alg !== "HS256") throw new Error(`Unsupported alg: ${header.alg}`);

  const expected = createHmac("sha256", toKeyBuffer(secret))
    .update(`${headerB64}.${payloadB64}`)
    .digest();
  const actual = b64urlDecode(signatureB64);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Invalid signature");
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch {
    throw new Error("Invalid token payload");
  }

  const exp = payload.exp;
  if (typeof exp === "number" && exp * 1000 < Date.now()) {
    throw new Error("Token expired");
  }

  return { payload, protectedHeader: { alg: header.alg, typ: header.typ } };
}
