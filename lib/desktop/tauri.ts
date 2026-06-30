// Desktop capability bridge. Tauri packages are imported DYNAMICALLY so the web
// bundle never pulls them in; on the web isTauri() is false and nothing here runs.
export type LocalRuntime = {
  baseUrl: string;
  kind: "ollama" | "lmstudio";
  models: { slug: string; name: string }[];
};

export function isTauri(): boolean {
  return typeof globalThis !== "undefined" && "__TAURI_INTERNALS__" in (globalThis as object);
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

let cached: LocalRuntime | null = null;

export async function detectLocalRuntime(): Promise<LocalRuntime | null> {
  const rt = await invoke<LocalRuntime | null>("detect_local_runtime");
  cached = rt ?? null;
  return cached;
}

export function getCachedRuntime(): LocalRuntime | null {
  return cached;
}

export async function invokeLlmChat(args: { baseUrl: string; model: string; prompt: string }): Promise<string> {
  try {
    return await invoke<string>("llm_chat", args);
  } catch (e) {
    // Tauri rejects commands with the Err string; normalize to an Error carrying the code.
    throw new Error(typeof e === "string" ? e : e instanceof Error ? e.message : "provider_error");
  }
}

export async function pickDirectory(): Promise<string | null> {
  return (await invoke<string | null>("pick_directory")) ?? null;
}

export async function saveFile(args: { dir: string; filename: string; bytes: number[] }): Promise<string> {
  try {
    return await invoke<string>("save_file", args);
  } catch (e) {
    throw new Error(typeof e === "string" ? e : e instanceof Error ? e.message : "write_failed");
  }
}
