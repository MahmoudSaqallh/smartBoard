let counter = 0;

/**
 * `crypto.randomUUID` only exists in secure contexts (HTTPS / localhost).
 * Testing over a LAN IP on plain HTTP would otherwise crash element creation.
 */
export function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
