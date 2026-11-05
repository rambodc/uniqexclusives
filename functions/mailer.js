// Sends one email through Resend's HTTP API. The API key comes from the RESEND_API_KEY secret and is never logged.
export const RESEND_ENDPOINT = "https://api.resend.com/emails";
export async function sendEmail(apiKey, message, { idempotencyKey, fetchImpl = globalThis.fetch } = {}) {
  // The local emulators never reach Resend: the message is logged (to, subject) and nothing is sent.
  if (process.env.FUNCTIONS_EMULATOR === "true" && fetchImpl === globalThis.fetch) {
    console.log(`[emulator] email not sent: to=${message.to.join(",")} subject=${message.subject}`);
    return "emulator";
  }
  if (!apiKey || !apiKey.startsWith("re_")) throw new Error("RESEND_API_KEY is not configured");
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetchImpl(RESEND_ENDPOINT, { method: "POST", headers, body: JSON.stringify(message), signal: AbortSignal.timeout(10_000) });
      if (response.ok) { const body = await response.json(); return body.id; }
      let detail = ""; try { detail = (await response.json())?.message ?? ""; } catch { /* not JSON */ }
      lastError = new Error(`Resend responded ${response.status}${detail ? `: ${detail}` : ""}`);
      if (!(response.status === 409 || response.status === 429 || response.status >= 500)) break;
    } catch (error) { lastError = error instanceof Error ? error : new Error(String(error)); }
    await new Promise((r) => setTimeout(r, attempt * 500));
  }
  throw lastError;
}
