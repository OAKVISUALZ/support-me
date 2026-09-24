const RPC_URL = process.env.SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";
const RPC_TIMEOUT_MS = 1500;

export async function checkSorobanRpc(): Promise<{ status: "ok" | "down"; latencyMs?: number }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);

  try {
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getLatestLedger", params: {} }),
      signal: controller.signal,
    });
    if (!response.ok) return { status: "down" };
    const body = (await response.json()) as { result?: { sequence?: number }; error?: unknown };
    if (body.error || typeof body.result?.sequence !== "number") return { status: "down" };
    return { status: "ok", latencyMs: Date.now() - startedAt };
  } catch {
    return { status: "down" };
  } finally {
    clearTimeout(timeout);
  }
}