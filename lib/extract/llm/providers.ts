import { lookup as dnsLookup } from "node:dns/promises";

export type ProviderId = "openrouter" | "openai" | "anthropic" | "google" | "custom";

export const PROVIDER_PRESETS: Record<Exclude<ProviderId, "custom">, { label: string; baseUrl: string }> = {
  openrouter: { label: "OpenRouter", baseUrl: "https://openrouter.ai/api/v1" },
  openai:     { label: "OpenAI",     baseUrl: "https://api.openai.com/v1" },
  anthropic:  { label: "Anthropic",  baseUrl: "https://api.anthropic.com/v1" },
  google:     { label: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai" },
};

export function resolveBaseUrl(provider: ProviderId, customUrl?: string): string {
  if (provider === "custom") return (customUrl ?? "").trim();
  return PROVIDER_PRESETS[provider].baseUrl;
}

export class BadEndpointError extends Error {
  constructor(msg = "Недопустимый адрес") { super(msg); this.name = "BadEndpointError"; }
}

/** Literal-IP block: private v4, loopback, link-local, unique-local v6, IPv6 loopback. */
export function isBlockedIp(ip: string): boolean {
  const v4 = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;          // link-local + metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === "::1" || lower === "::") return true;
  if (lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) return true;
  return false;
}

export async function assertSafeBaseUrl(
  url: string,
  lookup: (h: string) => Promise<{ address: string }[]> = (h) => dnsLookup(h, { all: true }),
): Promise<void> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new BadEndpointError(); }
  if (parsed.protocol !== "https:") throw new BadEndpointError();
  const host = parsed.hostname;
  if (isBlockedIp(host)) throw new BadEndpointError(); // literal-IP host
  let resolved: { address: string }[];
  try { resolved = await lookup(host); } catch { throw new BadEndpointError(); }
  if (resolved.some((r) => isBlockedIp(r.address))) throw new BadEndpointError();
}
