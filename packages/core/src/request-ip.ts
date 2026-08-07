const DEFAULT_TRUSTED_PROXY_HOPS = 1;

/**
 * Number of reverse proxies we operate in front of the app. Every one of them
 * appends the address of its own peer to `X-Forwarded-For`, so the entry this
 * many positions from the right is the last value we wrote ourselves.
 */
function trustedProxyHops(): number {
  const configured = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  return Number.isInteger(configured) && configured > 0
    ? configured
    : DEFAULT_TRUSTED_PROXY_HOPS;
}

/**
 * Resolves the peer address for throttling and audit logging.
 *
 * `X-Forwarded-For` is a client-writable header: a request may arrive with an
 * arbitrary list already in it, and the usual proxy configuration (nginx's
 * `$proxy_add_x_forwarded_for`) appends rather than replaces. Reading the
 * left-most entry therefore reads whatever the caller typed, which lets an
 * attacker mint a fresh identity per request and slip past any per-IP limit.
 * We count from the right instead, where only our own infrastructure writes.
 */
export function clientIpAddress(headers: Headers): string | null {
  if (process.env.TRUST_PROXY_HEADERS !== "true") return null;

  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
    // A chain shorter than our own proxy count means the request did not pass
    // through the expected path - trust nothing in it.
    const index = hops.length - trustedProxyHops();
    return index >= 0 ? hops[index] ?? null : null;
  }

  return headers.get("x-real-ip")?.trim() || null;
}
