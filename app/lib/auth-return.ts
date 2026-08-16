export const AUTH_RETURN_COOKIE = "moyeobap_auth_return";

export function normalizeAuthReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  try {
    const target = new URL(value, "http://moyeobap.local");
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "/";
  }
}
