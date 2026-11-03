import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/session", () => ({ ensureSession: vi.fn(async () => "test-session"), getDatabase: vi.fn(() => null) }));
vi.mock("@/lib/domain", () => ({ getSnapshot: vi.fn(async () => ({ replacements: [], pivots: [], history: [] })) }));

const { POST } = await import("./route");
const { GEMINI_ENDPOINT, GEMINI_TIMEOUT_MS } = await import("@/lib/gemini");

const replacements = [
  { id: "walk", name: "Walk", detail: "A short walk", duration: "5 min" },
  { id: "stretch", name: "Stretch", detail: "", duration: "3 min" },
];

function recommendationRequest(context: string) {
  return new Request("http://localhost/api/recommendation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ replacements, context, pivotId: "phone", tag: "bored" }),
  });
}

function geminiReply(value: unknown) {
  return new Response(JSON.stringify({ candidates: [{ finishReason: "STOP", content: { parts: [{ text: JSON.stringify(value) }] } }] }), { status: 200 });
}

describe("POST /api/recommendation with Gemini on", () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("ENABLE_GEMINI_RECOMMENDATIONS", "true");
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("routes crisis language to support without calling Gemini", async () => {
    const response = await POST(recommendationRequest("I want to hurt myself"));
    expect(await response.json()).toEqual({ safety: "review", route: "support" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses Gemini's pick from the configured model and timeout", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    fetchMock.mockResolvedValue(geminiReply({ replacementId: "stretch", reason: "A stretch fits.", firstStep: "Stand up.", alternatives: ["walk"], safety: "safe" }));
    const response = await POST(recommendationRequest("bored at my desk"));
    expect(await response.json()).toMatchObject({ replacementId: "stretch", source: "gemini" });
    expect(fetchMock).toHaveBeenCalledWith(GEMINI_ENDPOINT, expect.objectContaining({ method: "POST" }));
    expect(timeoutSpy).toHaveBeenCalledWith(GEMINI_TIMEOUT_MS);
  });

  it("falls back to the built-in suggestion when Gemini times out", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    const response = await POST(recommendationRequest("bored at my desk"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ source: "fallback", replacementId: expect.any(String) });
  });

  it("falls back when Gemini answers with an error status", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: { code: 404 } }), { status: 404 }));
    const response = await POST(recommendationRequest("bored at my desk"));
    expect(await response.json()).toMatchObject({ source: "fallback" });
  });

  it("routes to support when Gemini flags the note", async () => {
    fetchMock.mockResolvedValue(geminiReply({ safety: "blocked" }));
    const response = await POST(recommendationRequest("bored at my desk"));
    expect(await response.json()).toEqual({ safety: "review", route: "support" });
  });
});
