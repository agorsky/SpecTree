const TIMEOUT_MS = 5000;

export async function dispatch(url: string, payload: unknown): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);
    console.log("[webhook] dispatched to", url, "status:", response.status);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] failed:", message);
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      dispatch(url, payload).catch(() => {});
    }, 5000);
  }
}
