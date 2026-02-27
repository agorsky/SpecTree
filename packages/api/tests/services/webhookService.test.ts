import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let dispatch: (url: string, payload: unknown) => Promise<void>;

describe("webhookService", () => {
  const url = "https://example.com/hook";
  const payload = { event: "task.created", id: "123" };

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn());
    const mod = await import("../../src/services/webhookService.js");
    dispatch = mod.dispatch;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("sends a POST request with JSON content-type and logs success", async () => {
    const mockResponse = { status: 200 };
    vi.mocked(fetch).mockResolvedValueOnce(mockResponse as Response);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await dispatch(url, payload);

    expect(fetch).toHaveBeenCalledOnce();
    const call = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    expect(call[0]).toBe(url);
    expect(call[1].method).toBe("POST");
    expect(call[1].headers).toEqual({ "Content-Type": "application/json" });
    expect(call[1].body).toBe(JSON.stringify(payload));
    expect(call[1].signal).toBeInstanceOf(AbortSignal);

    expect(logSpy).toHaveBeenCalledWith(
      "[webhook] dispatched to",
      url,
      "status:",
      200
    );
  });

  it("logs error and schedules a retry on failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await dispatch(url, payload);

    expect(errorSpy).toHaveBeenCalledWith(
      "[webhook] failed:",
      "network error"
    );

    vi.mocked(fetch).mockResolvedValueOnce({ status: 200 } as Response);
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledWith(
      "[webhook] dispatched to",
      url,
      "status:",
      200
    );
  });

  it("retry failure is silently swallowed", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("first fail"));
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await dispatch(url, payload);

    vi.mocked(fetch).mockRejectedValueOnce(new Error("second fail"));
    await vi.advanceTimersByTimeAsync(5000);

    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("aborts fetch when timeout expires", async () => {
    vi.mocked(fetch).mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            reject(
              new DOMException("The operation was aborted.", "AbortError")
            );
          });
        })
    );
    const errorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const promise = dispatch(url, payload);
    await vi.advanceTimersByTimeAsync(5000);
    await promise;

    expect(errorSpy).toHaveBeenCalledWith(
      "[webhook] failed:",
      "The operation was aborted."
    );
  });
});
