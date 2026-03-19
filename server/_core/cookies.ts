import type { Request } from "express";

function isSecureRequest(req: Request) {
  const proto = (req.headers as Record<string, string | string[] | undefined>)["x-forwarded-proto"];
  const forwarded = Array.isArray(proto) ? proto[0] : proto;
  return forwarded === "https" || (req as any).protocol === "https";
}

export function getSessionCookieOptions(req: Request) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: isSecureRequest(req),
  };
}
