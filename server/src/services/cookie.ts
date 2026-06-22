import { Request, Response } from 'express';

const COOKIE_NAME = 'trek_session';

// Capacitor 移动端 App 使用 https://localhost 或 http://localhost 作为 origin
// 这些 origin 需要跨站 cookie，必须使用 SameSite=None; Secure
const CAPACITOR_ORIGINS = ['https://localhost', 'http://localhost', 'capacitor://localhost'];

function isCapacitorRequest(req?: Request): boolean {
  if (!req) return false;
  const origin = req.headers['origin'] as string | undefined;
  return !!origin && CAPACITOR_ORIGINS.includes(origin);
}

/**
 * Decide whether the session cookie should carry the `Secure` flag.
 *
 * We previously only derived this from `NODE_ENV=production` or
 * `FORCE_HTTPS=true`. That left behind a common self-host setup:
 * TREK running behind Traefik / Caddy / Cloudflare Tunnel with
 * `NODE_ENV=development` locally and no `FORCE_HTTPS` — the cookie
 * went out without `Secure`, even though the public leg was https.
 *
 * Now we also honour `req.secure`, which Express derives from
 * `X-Forwarded-Proto` once `trust proxy` is set (TREK sets it to `1`
 * in production automatically). If Express sees the request was TLS
 * on the outermost hop, the cookie is `Secure`. `COOKIE_SECURE=false`
 * remains the explicit escape hatch for plain-HTTP LAN testing.
 *
 * Capacitor 移动端 App 是跨站请求（https://localhost → 服务器），
 * 必须使用 SameSite=None; Secure 才能发送 cookie。
 */
export function cookieOptions(clear = false, req?: Request) {
  if (process.env.COOKIE_SECURE?.toLowerCase() === 'false') {
    return buildOptions(clear, false, isCapacitorRequest(req));
  }
  const envSecure = process.env.NODE_ENV?.toLowerCase() === 'production' || process.env.FORCE_HTTPS?.toLowerCase() === 'true';
  const requestSecure = req?.secure === true;
  return buildOptions(clear, envSecure || requestSecure, isCapacitorRequest(req));
}

function buildOptions(clear: boolean, secure: boolean, crossSite: boolean) {
  return {
    httpOnly: true,
    secure,
    // Capacitor 移动端是跨站请求，必须用 SameSite=None；其他用 Lax（更安全）
    sameSite: (crossSite ? 'none' : 'lax') as 'none' | 'lax',
    path: '/',
    ...(clear ? {} : { maxAge: 24 * 60 * 60 * 1000 }), // 24h — matches JWT expiry
  };
}

export function setAuthCookie(res: Response, token: string, req?: Request): void {
  res.cookie(COOKIE_NAME, token, cookieOptions(false, req));
}

export function clearAuthCookie(res: Response, req?: Request): void {
  res.clearCookie(COOKIE_NAME, cookieOptions(true, req));
}
