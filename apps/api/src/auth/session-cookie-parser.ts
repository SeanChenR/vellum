/**
 * Parse a Set-Cookie header string into its attributes.
 *
 * Used in tests to assert that session cookies carry the required security
 * attributes (HttpOnly, Secure, SameSite=Lax, Path=/).
 */

export interface CookieAttributes {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: string | null;
  path: string | null;
  maxAge: number | null;
  expires: Date | null;
}

export function parseCookieAttributes(setCookieHeader: string): CookieAttributes {
  const parts = setCookieHeader.split(";").map((p) => p.trim());
  const firstPart = parts[0] ?? "";
  const eqIdx = firstPart.indexOf("=");
  const name = eqIdx >= 0 ? firstPart.slice(0, eqIdx).trim() : firstPart;
  const value = eqIdx >= 0 ? firstPart.slice(eqIdx + 1).trim() : "";

  let httpOnly = false;
  let secure = false;
  let sameSite: string | null = null;
  let path: string | null = null;
  let maxAge: number | null = null;
  let expires: Date | null = null;

  for (const part of parts.slice(1)) {
    const lower = part.toLowerCase();
    if (lower === "httponly") {
      httpOnly = true;
    } else if (lower === "secure") {
      secure = true;
    } else if (lower.startsWith("samesite=")) {
      sameSite = part.slice("samesite=".length);
    } else if (lower.startsWith("path=")) {
      path = part.slice("path=".length);
    } else if (lower.startsWith("max-age=")) {
      maxAge = parseInt(part.slice("max-age=".length), 10);
    } else if (lower.startsWith("expires=")) {
      expires = new Date(part.slice("expires=".length));
    }
  }

  return { name, value, httpOnly, secure, sameSite, path, maxAge, expires };
}
