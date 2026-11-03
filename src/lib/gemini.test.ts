import { describe, expect, it } from "vitest";
import { GEMINI_API_VERSION, GEMINI_ENDPOINT, GEMINI_MODEL, GEMINI_THINKING_LEVEL, GEMINI_TIMEOUT_MS, RECOMMENDATION_REQUEST_TIMEOUT_MS, buildGeminiRequest, buildGeminiRequestBody } from "./gemini";

describe("Gemini configuration", () => {
  it("calls Gemini 3.5 Flash-Lite on the v1beta generateContent endpoint", () => {
    expect(GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
    expect(GEMINI_API_VERSION).toBe("v1beta");
    expect(GEMINI_ENDPOINT).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
  });

  it("asks for JSON with the lowest thinking level", () => {
    expect(GEMINI_THINKING_LEVEL).toBe("minimal");
    expect(buildGeminiRequestBody("hello")).toEqual({
      contents: [{ parts: [{ text: "hello" }] }],
      generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingLevel: "minimal" } },
    });
  });

  it("waits long enough for Gemini, but not so long that the built-in suggestion feels slow", () => {
    expect(GEMINI_TIMEOUT_MS).toBeGreaterThanOrEqual(6000);
    expect(GEMINI_TIMEOUT_MS).toBeLessThanOrEqual(8000);
  });

  it("lets the app wait longer than the server waits for Gemini, so the server's fallback still arrives", () => {
    expect(RECOMMENDATION_REQUEST_TIMEOUT_MS - GEMINI_TIMEOUT_MS).toBeGreaterThanOrEqual(2000);
  });

  it("sends the key in a header and aborts at the timeout", () => {
    const request = buildGeminiRequest("hello", "test-key");
    expect(request.method).toBe("POST");
    expect(new Headers(request.headers).get("x-goog-api-key")).toBe("test-key");
    expect(request.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(request.body))).toEqual(buildGeminiRequestBody("hello"));
  });
});
