import { describe, expect, mock, test } from "bun:test";
import {
  AnkiConnectClient,
  AnkiConnectError,
  isRetryableAnkiConnectError,
} from "../../src/anki/client";

describe("isRetryableAnkiConnectError", () => {
  test("matches AnkiConnect transient connection errors", () => {
    expect(
      isRetryableAnkiConnectError(
        new AnkiConnectError(
          "Unable to connect. Is the computer able to access the url?",
        ),
      ),
    ).toBe(true);
  });

  test("does not retry collection errors", () => {
    expect(
      isRetryableAnkiConnectError(
        new AnkiConnectError("collection not available"),
      ),
    ).toBe(false);
  });
});

describe("AnkiConnectClient invoke resilience", () => {
  test("retries transient AnkiConnect errors", async () => {
    let attempts = 0;
    const fetchImpl = mock(async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(
          JSON.stringify({
            result: null,
            error: "Unable to connect. Is the computer able to access the url?",
          }),
        );
      }
      return new Response(JSON.stringify({ result: 6, error: null }));
    });

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      fetchImpl: fetchImpl as typeof fetch,
      retryBaseDelayMs: 1,
    });

    await expect(client.version()).resolves.toBe(6);
    expect(attempts).toBe(2);
  });

  test("limits concurrent HTTP requests", async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const fetchImpl = mock(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 20));
      inFlight -= 1;
      return new Response(JSON.stringify({ result: 6, error: null }));
    });

    const client = new AnkiConnectClient({
      url: "http://127.0.0.1:8765",
      fetchImpl: fetchImpl as typeof fetch,
      requestConcurrency: 2,
    });

    await Promise.all([
      client.version(),
      client.version(),
      client.version(),
      client.version(),
    ]);

    expect(maxInFlight).toBeLessThanOrEqual(2);
    expect(maxInFlight).toBeGreaterThanOrEqual(2);
  });
});
